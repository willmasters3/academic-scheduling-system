const sql = require('mssql');
const moment = require('moment');
const config = require('../../dbConfig');

let poolPromise = null;

const TURNO_MINUTOS_PADRAO = {
    manha: 240,
    tarde: 240,
    noite: 240
};

function parseTurnos(valor) {
    return String(valor || '')
        .split(',')
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean);
}

function minutosEntre(horaInicio, horaFim) {
    if (!horaInicio || !horaFim) {
        return 0;
    }

    const inicio = moment(horaInicio, ['HH:mm:ss', 'HH:mm'], true);
    const fim = moment(horaFim, ['HH:mm:ss', 'HH:mm'], true);

    if (!inicio.isValid() || !fim.isValid()) {
        return 0;
    }

    return Math.max(0, moment.duration(fim.diff(inicio)).asMinutes());
}

function diaNoMesAtendeVigencia(dataDia, vigenciaInicio, vigenciaFim) {
    const dia = moment(dataDia, 'YYYY-MM-DD', true);
    if (!dia.isValid()) {
        return false;
    }

    if (vigenciaInicio) {
        const inicio = moment(vigenciaInicio).startOf('day');
        if (dia.isBefore(inicio, 'day')) {
            return false;
        }
    }

    if (vigenciaFim) {
        const fim = moment(vigenciaFim).endOf('day');
        if (dia.isAfter(fim, 'day')) {
            return false;
        }
    }

    return true;
}

async function buscarDadosProfessorMes(pool, idProfessor) {
    const dados = {
        turnoPrincipal: null,
        cargaHorariaSemanal: null,
        disponibilidades: []
    };

    const colunasProfessor = await pool.request()
        .query(`
            SELECT
                CASE WHEN COL_LENGTH('dbo.professores', 'turno_principal') IS NULL THEN 0 ELSE 1 END AS possui_turno_principal,
                CASE WHEN COL_LENGTH('dbo.professores', 'carga_horaria_semanal') IS NULL THEN 0 ELSE 1 END AS possui_carga_horaria_semanal
        `);

    const possuiTurnoPrincipal = Number(colunasProfessor.recordset?.[0]?.possui_turno_principal) === 1;
    const possuiCargaHoraria = Number(colunasProfessor.recordset?.[0]?.possui_carga_horaria_semanal) === 1;

    const professorSql = `
        SELECT ${possuiTurnoPrincipal ? 'turno_principal' : 'NULL AS turno_principal'},
               ${possuiCargaHoraria ? 'carga_horaria_semanal' : 'NULL AS carga_horaria_semanal'}
        FROM dbo.professores
        WHERE id_professor = @id_professor
    `;

    const professorResult = await pool.request()
        .input('id_professor', sql.Int, idProfessor)
        .query(professorSql);

    const professor = professorResult.recordset?.[0];
    if (professor) {
        dados.turnoPrincipal = professor.turno_principal || null;
        dados.cargaHorariaSemanal = professor.carga_horaria_semanal ?? null;
    }

    const existeDisponibilidade = await pool.request()
        .query("SELECT CASE WHEN OBJECT_ID('dbo.ProfessorDisponibilidade', 'U') IS NULL THEN 0 ELSE 1 END AS existe");

    if (Number(existeDisponibilidade.recordset?.[0]?.existe) === 1) {
        const disponibilidadeResult = await pool.request()
            .input('id_professor', sql.Int, idProfessor)
            .query(`
                SELECT dia_semana, turno, hora_inicio, hora_fim, vigencia_inicio, vigencia_fim
                FROM dbo.ProfessorDisponibilidade
                WHERE id_professor = @id_professor
                  AND ativo = 1
            `);

        dados.disponibilidades = disponibilidadeResult.recordset || [];
    }

    return dados;
}

function calcularMinutosDisponiveisMes({ inicioMes, fimMes, turnoPrincipal, cargaHorariaSemanal, disponibilidades }) {
    const diasDoMes = [];
    const cursor = inicioMes.clone();

    while (cursor.isSameOrBefore(fimMes, 'day')) {
        diasDoMes.push(cursor.clone());
        cursor.add(1, 'day');
    }

    if (Array.isArray(disponibilidades) && disponibilidades.length > 0) {
        let totalMinutos = 0;

        diasDoMes.forEach((dia) => {
            const diaSemana = dia.isoWeekday();

            disponibilidades.forEach((item) => {
                if (Number(item.dia_semana) !== diaSemana) {
                    return;
                }

                if (!diaNoMesAtendeVigencia(dia.format('YYYY-MM-DD'), item.vigencia_inicio, item.vigencia_fim)) {
                    return;
                }

                const minutos = minutosEntre(item.hora_inicio, item.hora_fim)
                    || TURNO_MINUTOS_PADRAO[String(item.turno || '').toLowerCase()]
                    || 0;

                totalMinutos += minutos;
            });
        });

        if (totalMinutos > 0) {
            return totalMinutos;
        }
    }

    const turnosSelecionados = [...new Set(parseTurnos(turnoPrincipal))];
    if (turnosSelecionados.length > 0) {
        const diasUteis = diasDoMes.filter((dia) => dia.isoWeekday() >= 1 && dia.isoWeekday() <= 5).length;
        const minutosPorDia = turnosSelecionados.reduce((total, turno) => total + (TURNO_MINUTOS_PADRAO[turno] || 0), 0);

        if (minutosPorDia > 0) {
            return diasUteis * minutosPorDia;
        }
    }

    if (Number(cargaHorariaSemanal) > 0) {
        const semanasNoMes = diasDoMes.length / 7;
        return Math.round(Number(cargaHorariaSemanal) * 60 * semanasNoMes);
    }

    // Fallback conservador para manter o dashboard funcionando sem dados de disponibilidade.
    const diasUteis = diasDoMes.filter((dia) => dia.isoWeekday() >= 1 && dia.isoWeekday() <= 5).length;
    return diasUteis * 14 * 60;
}

function getPool() {
    if (!poolPromise) {
        poolPromise = sql.connect(config).catch((error) => {
            poolPromise = null;
            throw error;
        });
    }

    return poolPromise;
}

async function hasProfessorAgendaPessoalTable(pool) {
    const result = await pool.request().query(`
        SELECT CASE WHEN OBJECT_ID('dbo.ProfessorAgendaPessoal', 'U') IS NULL THEN 0 ELSE 1 END AS existe
    `);

    return Number(result.recordset?.[0]?.existe) === 1;
}

function validarDataIso(data) {
    return moment(String(data || ''), 'YYYY-MM-DD', true).isValid();
}

function validarHora(hora) {
    return moment(String(hora || ''), ['HH:mm', 'HH:mm:ss'], true).isValid();
}

async function criarCompromissoAgendaProfessor(idProfessor, { titulo, data, horaInicio, horaFim, descricao }) {
    const tituloLimpo = String(titulo || '').trim();
    const dataLimpa = String(data || '').trim();
    const horaInicioLimpa = String(horaInicio || '').trim();
    const horaFimLimpa = String(horaFim || '').trim();
    const descricaoLimpa = String(descricao || '').trim();

    if (!tituloLimpo) {
        return { statusCode: 400, body: { error: 'Título é obrigatório.' } };
    }

    if (!validarDataIso(dataLimpa)) {
        return { statusCode: 400, body: { error: 'Data inválida. Use o formato YYYY-MM-DD.' } };
    }

    if (!validarHora(horaInicioLimpa) || !validarHora(horaFimLimpa)) {
        return { statusCode: 400, body: { error: 'Hora de início/fim inválida.' } };
    }

    const inicio = moment(horaInicioLimpa, ['HH:mm', 'HH:mm:ss'], true);
    const fim = moment(horaFimLimpa, ['HH:mm', 'HH:mm:ss'], true);
    if (!fim.isAfter(inicio)) {
        return { statusCode: 400, body: { error: 'A hora de fim deve ser maior que a hora de início.' } };
    }

    const pool = await getPool();
    const hasTable = await hasProfessorAgendaPessoalTable(pool);
    if (!hasTable) {
        return {
            statusCode: 503,
            body: {
                error: 'Agenda pessoal ainda não está habilitada no banco. Execute a migração SQL de agenda pessoal e tente novamente.'
            }
        };
    }

    await pool.request()
        .input('id_professor', sql.Int, idProfessor)
        .input('titulo', sql.NVarChar(150), tituloLimpo)
        .input('data_compromisso', sql.Date, dataLimpa)
        .input('hora_inicio_txt', sql.NVarChar(8), inicio.format('HH:mm:ss'))
        .input('hora_fim_txt', sql.NVarChar(8), fim.format('HH:mm:ss'))
        .input('descricao', sql.NVarChar(sql.MAX), descricaoLimpa || null)
        .query(`
            INSERT INTO dbo.ProfessorAgendaPessoal (
                id_professor,
                titulo,
                data_compromisso,
                hora_inicio,
                hora_fim,
                descricao
            )
            VALUES (
                @id_professor,
                @titulo,
                @data_compromisso,
                CONVERT(TIME(0), @hora_inicio_txt),
                CONVERT(TIME(0), @hora_fim_txt),
                @descricao
            )
        `);

    return {
        statusCode: 201,
        body: {
            ok: true,
            message: 'Compromisso pessoal salvo com sucesso.'
        }
    };
}

async function horasAgendadasMes(idProfessor) {
    const inicioMes = moment().startOf('month').format('YYYY-MM-DD');
    const fimMes = moment().endOf('month').format('YYYY-MM-DD');
    const inicioMesMoment = moment(inicioMes, 'YYYY-MM-DD');
    const fimMesMoment = moment(fimMes, 'YYYY-MM-DD');

    const pool = await getPool();
    const result = await pool.request()
        .input('id_professor', sql.Int, idProfessor)
        .input('inicioMes', sql.NVarChar, inicioMes)
        .input('fimMes', sql.NVarChar, fimMes)
        .query(`
            SELECT hora_inicio, hora_fim, id_sala
            FROM agendamentos
            WHERE id_professor = @id_professor
            AND data_reservas BETWEEN @inicioMes AND @fimMes
        `);

    const agendamentos = result.recordset;
    const salasSet = new Set();
    let totalMinutos = 0;

    agendamentos.forEach(({ hora_inicio, hora_fim, id_sala }) => {
        const inicio = moment(hora_inicio, 'HH:mm');
        const fim = moment(hora_fim, 'HH:mm');
        const duracao = moment.duration(fim.diff(inicio));
        totalMinutos += duracao.asMinutes();
        salasSet.add(id_sala);
    });

    const horas = Math.floor(totalMinutos / 60);
    const minutos = Math.round(totalMinutos % 60);
    const quantidadeAgendamentos = agendamentos.length;
    const salasUtilizadas = salasSet.size;

    const dadosProfessor = await buscarDadosProfessorMes(pool, idProfessor);
    const minutosDisponiveis = calcularMinutosDisponiveisMes({
        inicioMes: inicioMesMoment,
        fimMes: fimMesMoment,
        turnoPrincipal: dadosProfessor.turnoPrincipal,
        cargaHorariaSemanal: dadosProfessor.cargaHorariaSemanal,
        disponibilidades: dadosProfessor.disponibilidades
    });

    const horasDisponiveis = Math.max(0, minutosDisponiveis / 60);
    const horasAgendadasDecimal = horas + (minutos / 60);
    const taxaOcupacao = horasDisponiveis > 0
        ? (horasAgendadasDecimal / horasDisponiveis) * 100
        : 0;

    return {
        horas,
        minutos,
        agendamentos: quantidadeAgendamentos,
        salas_utilizadas: salasUtilizadas,
        horas_disponiveis: Math.floor(minutosDisponiveis / 60),
        minutos_disponiveis: Math.round(minutosDisponiveis % 60),
        taxa_ocupacao: taxaOcupacao
    };
}

async function agendaSemanalProfessor(idProfessor) {
    const hoje = moment();
    const inicioSemana = hoje.clone().startOf('week');
    const fimSemana = hoje.clone().endOf('week');

    const pool = await getPool();
    const result = await pool.request()
        .input('id_professor', sql.Int, idProfessor)
        .input('inicio', sql.NVarChar, inicioSemana.format('YYYY-MM-DD'))
        .input('fim', sql.NVarChar, fimSemana.format('YYYY-MM-DD'))
        .query(`
            SELECT data_reservas, hora_inicio, hora_fim, s.nome_sala
            FROM agendamentos a
            JOIN Salas s ON a.id_sala = s.id_sala
            WHERE a.id_professor = @id_professor
            AND data_reservas BETWEEN @inicio AND @fim
        `);

    const agenda = {};
    result.recordset.forEach(({ data_reservas, hora_inicio, hora_fim, nome_sala }) => {
        const dia = moment(data_reservas).format('dddd');
        if (!agenda[dia]) {
            agenda[dia] = [];
        }

        agenda[dia].push(`${hora_inicio} - ${hora_fim} (${nome_sala})`);
    });

    return agenda;
}

async function agendaProfessorPorPeriodo(idProfessor, inicio, fimExclusivo) {
    const pool = await getPool();
    const result = await pool.request()
        .input('id_professor', sql.Int, idProfessor)
        .input('inicio', sql.NVarChar, inicio)
        .input('fimExclusivo', sql.NVarChar, fimExclusivo)
        .query(`
            SELECT a.id_agendamento,
                CONVERT(varchar(10), a.data_reservas, 23) AS data_reservas,
                CONVERT(varchar(8), a.hora_inicio, 108) AS hora_inicio,
                CONVERT(varchar(8), a.hora_fim, 108) AS hora_fim,
                s.nome_sala,
                a.motivo,
                a.tipo_aula
            FROM agendamentos a
            JOIN Salas s ON a.id_sala = s.id_sala
            WHERE a.id_professor = @id_professor
              AND a.data_reservas >= @inicio
              AND a.data_reservas < @fimExclusivo
            ORDER BY a.data_reservas, a.hora_inicio
        `);

    const eventosAgendamentos = result.recordset.map((item) => ({
        id: item.id_agendamento,
        title: item.nome_sala,
        start: `${item.data_reservas}T${item.hora_inicio}`,
        end: `${item.data_reservas}T${item.hora_fim}`,
        extendedProps: {
            tipo_evento: 'agendamento_sala',
            nome_sala: item.nome_sala,
            motivo: item.motivo,
            tipo_aula: item.tipo_aula
        }
    }));

    const hasAgendaPessoalTable = await hasProfessorAgendaPessoalTable(pool);
    if (!hasAgendaPessoalTable) {
        return eventosAgendamentos;
    }

    const compromissosResult = await pool.request()
        .input('id_professor', sql.Int, idProfessor)
        .input('inicio', sql.NVarChar, inicio)
        .input('fimExclusivo', sql.NVarChar, fimExclusivo)
        .query(`
            SELECT id_compromisso,
                   CONVERT(varchar(10), data_compromisso, 23) AS data_compromisso,
                   CONVERT(varchar(8), hora_inicio, 108) AS hora_inicio,
                   CONVERT(varchar(8), hora_fim, 108) AS hora_fim,
                   titulo,
                   descricao
            FROM dbo.ProfessorAgendaPessoal
            WHERE id_professor = @id_professor
              AND data_compromisso >= @inicio
              AND data_compromisso < @fimExclusivo
            ORDER BY data_compromisso, hora_inicio
        `);

    const eventosPessoais = compromissosResult.recordset.map((item) => ({
        id: `pessoal-${item.id_compromisso}`,
        title: item.titulo,
        start: `${item.data_compromisso}T${item.hora_inicio}`,
        end: `${item.data_compromisso}T${item.hora_fim}`,
        classNames: ['agenda-evento-compromisso'],
        backgroundColor: '#6b7280',
        borderColor: '#6b7280',
        extendedProps: {
            tipo_evento: 'compromisso_pessoal',
            nome_sala: 'Compromisso pessoal',
            motivo: item.descricao,
            tipo_aula: null,
            titulo_original: item.titulo
        }
    }));

    return [...eventosAgendamentos, ...eventosPessoais];
}

async function topSalasProfessor(idProfessor) {
    const doisMesesAtras = moment().subtract(2, 'months').format('YYYY-MM-DD');

    const pool = await getPool();
    const result = await pool.request()
        .input('id_professor', sql.Int, idProfessor)
        .input('dataInicio', sql.NVarChar, doisMesesAtras)
        .query(`
            SELECT TOP 5 s.nome_sala, COUNT(*) AS quantidade
            FROM agendamentos a
            JOIN Salas s ON a.id_sala = s.id_sala
            WHERE a.id_professor = @id_professor
            AND a.data_reservas >= @dataInicio
            GROUP BY s.nome_sala
            ORDER BY quantidade DESC
        `);

    return result.recordset;
}

function getIntervalosPadraoPorTurno(turno) {
    const mapa = {
        manha: { inicio: '07:45', fim: '11:45' },
        tarde: { inicio: '13:15', fim: '17:15' },
        noite: { inicio: '19:00', fim: '22:40' }
    };

    return mapa[String(turno || '').toLowerCase()] || null;
}

function parseHoraToMoment(hora) {
    const parsed = moment(String(hora || ''), ['HH:mm:ss', 'HH:mm'], true);
    return parsed.isValid() ? parsed : null;
}

function subtrairIntervalos(intervalosBase, reservasNoDia) {
    let intervalosLivres = [...intervalosBase];

    reservasNoDia.forEach((agendamento) => {
        const inicioReserva = parseHoraToMoment(agendamento.hora_inicio);
        const fimReserva = parseHoraToMoment(agendamento.hora_fim);
        if (!inicioReserva || !fimReserva) {
            return;
        }

        const novosIntervalos = [];
        intervalosLivres.forEach((intervalo) => {
            if (inicioReserva.isSameOrBefore(intervalo.inicio) && fimReserva.isSameOrAfter(intervalo.fim)) {
                return;
            }

            if (inicioReserva.isAfter(intervalo.inicio) && fimReserva.isBefore(intervalo.fim)) {
                novosIntervalos.push({ inicio: intervalo.inicio, fim: inicioReserva });
                novosIntervalos.push({ inicio: fimReserva, fim: intervalo.fim });
                return;
            }

            if (inicioReserva.isSameOrBefore(intervalo.inicio) && fimReserva.isBefore(intervalo.fim) && fimReserva.isAfter(intervalo.inicio)) {
                novosIntervalos.push({ inicio: fimReserva, fim: intervalo.fim });
                return;
            }

            if (inicioReserva.isAfter(intervalo.inicio) && inicioReserva.isBefore(intervalo.fim) && fimReserva.isSameOrAfter(intervalo.fim)) {
                novosIntervalos.push({ inicio: intervalo.inicio, fim: inicioReserva });
                return;
            }

            novosIntervalos.push(intervalo);
        });

        intervalosLivres = novosIntervalos.filter((i) => i.fim.diff(i.inicio, 'minutes') > 0);
    });

    return intervalosLivres;
}

async function carregarPerfilProfessor(pool, idProfessor) {
    const colunasResult = await pool.request().query(`
        SELECT
            CASE WHEN COL_LENGTH('dbo.professores', 'turno_principal') IS NULL THEN 0 ELSE 1 END AS possui_turno_principal,
            CASE WHEN COL_LENGTH('dbo.professores', 'carga_horaria_semanal') IS NULL THEN 0 ELSE 1 END AS possui_carga_horaria
    `);

    const possuiTurno = Number(colunasResult.recordset?.[0]?.possui_turno_principal) === 1;
    const possuiCarga = Number(colunasResult.recordset?.[0]?.possui_carga_horaria) === 1;

    const perfilSql = `
        SELECT ${possuiTurno ? 'turno_principal' : 'NULL AS turno_principal'},
               ${possuiCarga ? 'carga_horaria_semanal' : 'NULL AS carga_horaria_semanal'}
        FROM dbo.professores
        WHERE id_professor = @id_professor
    `;

    const perfilResult = await pool.request()
        .input('id_professor', sql.Int, idProfessor)
        .query(perfilSql);

    return perfilResult.recordset?.[0] || null;
}

async function carregarDisponibilidadePerfil(pool, idProfessor) {
    const existeTabela = await pool.request()
        .query("SELECT CASE WHEN OBJECT_ID('dbo.ProfessorDisponibilidade', 'U') IS NULL THEN 0 ELSE 1 END AS existe");

    if (Number(existeTabela.recordset?.[0]?.existe) !== 1) {
        return [];
    }

    const result = await pool.request()
        .input('id_professor', sql.Int, idProfessor)
        .query(`
            SELECT dia_semana, turno, hora_inicio, hora_fim, vigencia_inicio, vigencia_fim
            FROM dbo.ProfessorDisponibilidade
            WHERE id_professor = @id_professor
              AND ativo = 1
        `);

    return result.recordset || [];
}

function montarBaseIntervalosPorDia({ diaMoment, modoJornada, horaInicioJornada, horaFimJornada, perfilProfessor, disponibilidadePerfil }) {
    if (modoJornada === 'manual') {
        const inicioManual = parseHoraToMoment(horaInicioJornada);
        const fimManual = parseHoraToMoment(horaFimJornada);
        if (inicioManual && fimManual && fimManual.isAfter(inicioManual)) {
            return [{ inicio: inicioManual, fim: fimManual }];
        }
        return [];
    }

    const isoDia = diaMoment.isoWeekday();

    const perfisNoDia = disponibilidadePerfil.filter((item) => {
        if (Number(item.dia_semana) !== isoDia) {
            return false;
        }

        if (item.vigencia_inicio && diaMoment.isBefore(moment(item.vigencia_inicio), 'day')) {
            return false;
        }

        if (item.vigencia_fim && diaMoment.isAfter(moment(item.vigencia_fim), 'day')) {
            return false;
        }

        return true;
    });

    if (perfisNoDia.length > 0) {
        return perfisNoDia
            .map((item) => {
                const inicio = parseHoraToMoment(item.hora_inicio);
                const fim = parseHoraToMoment(item.hora_fim);
                if (inicio && fim && fim.isAfter(inicio)) {
                    return { inicio, fim, turno: item.turno };
                }

                const intervaloPadrao = getIntervalosPadraoPorTurno(item.turno);
                if (!intervaloPadrao) {
                    return null;
                }

                const inicioPadrao = parseHoraToMoment(intervaloPadrao.inicio);
                const fimPadrao = parseHoraToMoment(intervaloPadrao.fim);
                if (!inicioPadrao || !fimPadrao || !fimPadrao.isAfter(inicioPadrao)) {
                    return null;
                }

                return { inicio: inicioPadrao, fim: fimPadrao, turno: item.turno };
            })
            .filter(Boolean);
    }

    const turnos = parseTurnos(perfilProfessor?.turno_principal);
    const intervalosTurno = turnos
        .map((turno) => {
            const padrao = getIntervalosPadraoPorTurno(turno);
            if (!padrao) {
                return null;
            }
            const inicio = parseHoraToMoment(padrao.inicio);
            const fim = parseHoraToMoment(padrao.fim);
            if (!inicio || !fim || !fim.isAfter(inicio)) {
                return null;
            }
            return { inicio, fim, turno };
        })
        .filter(Boolean);

    if (intervalosTurno.length > 0) {
        const diaUtil = isoDia >= 1 && isoDia <= 5;
        return diaUtil ? intervalosTurno : [];
    }

    const inicioFallback = parseHoraToMoment(horaInicioJornada || '07:00');
    const fimFallback = parseHoraToMoment(horaFimJornada || '13:00');
    if (inicioFallback && fimFallback && fimFallback.isAfter(inicioFallback)) {
        return [{ inicio: inicioFallback, fim: fimFallback }];
    }

    return [];
}

function aplicarFiltrosIntervalos(intervalos, { filtroTurno, duracaoMinima }) {
    const turnoFiltro = String(filtroTurno || '').trim().toLowerCase();
    const duracaoMinimaNumero = Number(duracaoMinima || 0);

    let filtrados = [...intervalos];

    if (turnoFiltro) {
        const janela = getIntervalosPadraoPorTurno(turnoFiltro);
        if (janela) {
            const inicioJanela = parseHoraToMoment(janela.inicio);
            const fimJanela = parseHoraToMoment(janela.fim);
            filtrados = filtrados.filter((i) => i.inicio.isBefore(fimJanela) && i.fim.isAfter(inicioJanela));
        }
    }

    if (!Number.isNaN(duracaoMinimaNumero) && duracaoMinimaNumero > 0) {
        filtrados = filtrados.filter((i) => i.fim.diff(i.inicio, 'minutes') >= duracaoMinimaNumero);
    }

    return filtrados;
}

async function professorDisponibilidade(
    idProfessor,
    dataInicio,
    dataFim,
    horaInicioJornada,
    horaFimJornada,
    modoJornada = 'auto',
    filtroTurno,
    filtroDiaSemana,
    duracaoMinima
) {
    const pool = await getPool();
    const perfilProfessor = await carregarPerfilProfessor(pool, idProfessor);
    const disponibilidadePerfil = await carregarDisponibilidadePerfil(pool, idProfessor);

    const agendamentosResult = await pool.request()
        .input('id_professor', sql.Int, idProfessor)
        .input('dataInicio', sql.NVarChar, dataInicio)
        .input('dataFim', sql.NVarChar, dataFim)
        .query(`
            SELECT CONVERT(varchar(10), data_reservas, 23) AS data_reservas, hora_inicio, hora_fim
            FROM agendamentos
            WHERE id_professor = @id_professor
            AND data_reservas BETWEEN @dataInicio AND @dataFim
            ORDER BY data_reservas, hora_inicio
        `);

    const agendamentos = [...agendamentosResult.recordset];

    const hasAgendaPessoalTable = await hasProfessorAgendaPessoalTable(pool);
    if (hasAgendaPessoalTable) {
        const compromissosResult = await pool.request()
            .input('id_professor', sql.Int, idProfessor)
            .input('dataInicio', sql.NVarChar, dataInicio)
            .input('dataFim', sql.NVarChar, dataFim)
            .query(`
                SELECT CONVERT(varchar(10), data_compromisso, 23) AS data_reservas,
                                             CONVERT(varchar(8), hora_inicio, 108) AS hora_inicio,
                                             CONVERT(varchar(8), hora_fim, 108) AS hora_fim
                FROM dbo.ProfessorAgendaPessoal
                WHERE id_professor = @id_professor
                  AND data_compromisso BETWEEN @dataInicio AND @dataFim
            `);

        agendamentos.push(...(compromissosResult.recordset || []));
    }
    const diasParaChecar = [];
    let diaAtual = moment(dataInicio);
    const diaFim = moment(dataFim);

    while (diaAtual.isSameOrBefore(diaFim)) {
        diasParaChecar.push(diaAtual.format('YYYY-MM-DD'));
        diaAtual.add(1, 'days');
    }

    const disponibilidade = {};

    const filtroDiaSemanaNumero = String(filtroDiaSemana || '').trim() === ''
        ? null
        : Number(filtroDiaSemana);

    diasParaChecar.forEach((data) => {
        const diaMoment = moment(data, 'YYYY-MM-DD');
        const diaSemanaZeroBased = diaMoment.day();

        if (filtroDiaSemanaNumero !== null && !Number.isNaN(filtroDiaSemanaNumero) && diaSemanaZeroBased !== filtroDiaSemanaNumero) {
            return;
        }

        const agendamentosNoDia = agendamentos.filter((a) => a.data_reservas === data);
        const intervalosBase = montarBaseIntervalosPorDia({
            diaMoment,
            modoJornada: String(modoJornada || 'auto').toLowerCase() === 'manual' ? 'manual' : 'auto',
            horaInicioJornada,
            horaFimJornada,
            perfilProfessor,
            disponibilidadePerfil
        });

        if (!intervalosBase.length) {
            return;
        }

        const intervalosLivres = subtrairIntervalos(intervalosBase, agendamentosNoDia);
        const intervalosFiltrados = aplicarFiltrosIntervalos(intervalosLivres, {
            filtroTurno,
            duracaoMinima
        });

        if (intervalosFiltrados.length > 0) {
            disponibilidade[data] = intervalosFiltrados.map((i) => ({
                inicio: i.inicio.format('HH:mm'),
                fim: i.fim.format('HH:mm')
            }));
        }
    });

    const totalIntervalos = Object.values(disponibilidade).reduce((acc, intervalos) => acc + intervalos.length, 0);

    const modoEfetivo = String(modoJornada || 'auto').toLowerCase() === 'manual' ? 'manual' : 'auto';
    const origemJornada = modoEfetivo === 'manual'
        ? 'manual'
        : (disponibilidadePerfil.length ? 'perfil_disponibilidade' : (parseTurnos(perfilProfessor?.turno_principal).length ? 'perfil_turno' : 'fallback'));

    return {
        id_professor: idProfessor,
        disponibilidade,
        meta: {
            origem_jornada: origemJornada,
            modo_jornada: modoEfetivo,
            filtro_turno: filtroTurno || null,
            filtro_dia_semana: filtroDiaSemana ?? null,
            duracao_minima: Number(duracaoMinima || 0) || 0,
            total_dias_livres: Object.keys(disponibilidade).length,
            total_intervalos: totalIntervalos,
            turnos_professor: parseTurnos(perfilProfessor?.turno_principal),
            carga_horaria_semanal: perfilProfessor?.carga_horaria_semanal ?? null
        }
    };
}

async function relatorioHorasPorUc(idProfessor) {
    const anoAtual = new Date().getFullYear();
    const pool = await getPool();
    const result = await pool.request()
        .input('id_professor', sql.Int, idProfessor)
        .input('anoAtual', sql.Int, anoAtual)
        .query(`
            SELECT
                tipo_aula,
                SUM(DATEDIFF(minute, hora_inicio, hora_fim)) AS total_minutos
            FROM agendamentos
            WHERE id_professor = @id_professor AND YEAR(data_reservas) = @anoAtual
            GROUP BY tipo_aula
            ORDER BY total_minutos DESC;
        `);

    return result.recordset.map((item) => ({
        tipo_aula: item.tipo_aula,
        horas: Math.floor(item.total_minutos / 60),
        minutos: item.total_minutos % 60
    }));
}

async function relatorioUsoSalas(idProfessor) {
    const anoAtual = new Date().getFullYear();
    const pool = await getPool();
    const result = await pool.request()
        .input('id_professor', sql.Int, idProfessor)
        .input('anoAtual', sql.Int, anoAtual)
        .query(`
            SELECT
                s.nome_sala,
                COUNT(a.id_agendamento) AS quantidade_usos,
                SUM(DATEDIFF(minute, a.hora_inicio, a.hora_fim)) AS total_minutos
            FROM agendamentos a
            JOIN Salas s ON a.id_sala = s.id_sala
            WHERE a.id_professor = @id_professor AND YEAR(a.data_reservas) = @anoAtual
            GROUP BY s.nome_sala
            ORDER BY quantidade_usos DESC;
        `);

    return result.recordset.map((item) => ({
        nome_sala: item.nome_sala,
        quantidade_usos: item.quantidade_usos,
        horas: Math.floor(item.total_minutos / 60),
        minutos: item.total_minutos % 60
    }));
}

async function relatorioAgendamentosPeriodo(idProfessor) {
    const anoAtual = new Date().getFullYear();
    const pool = await getPool();
    const result = await pool.request()
        .input('id_professor', sql.Int, idProfessor)
        .input('anoAtual', sql.Int, anoAtual)
        .query(`
            SET LANGUAGE Brazilian;
            SELECT
                DATENAME(weekday, data_reservas) AS dia_semana,
                CASE
                    WHEN CAST(hora_inicio AS TIME) < '12:00' THEN 'Manhã'
                    WHEN CAST(hora_inicio AS TIME) >= '12:00' AND CAST(hora_inicio AS TIME) < '18:00' THEN 'Tarde'
                    ELSE 'Noite'
                END AS turno,
                COUNT(id_agendamento) AS quantidade
            FROM agendamentos
            WHERE id_professor = @id_professor AND YEAR(data_reservas) = @anoAtual
            GROUP BY DATENAME(weekday, data_reservas),
                     CASE
                        WHEN CAST(hora_inicio AS TIME) < '12:00' THEN 'Manhã'
                        WHEN CAST(hora_inicio AS TIME) >= '12:00' AND CAST(hora_inicio AS TIME) < '18:00' THEN 'Tarde'
                        ELSE 'Noite'
                     END
            ORDER BY
                CASE DATENAME(weekday, data_reservas)
                    WHEN 'Domingo' THEN 1 WHEN 'Segunda-feira' THEN 2 WHEN 'Terça-feira' THEN 3
                    WHEN 'Quarta-feira' THEN 4 WHEN 'Quinta-feira' THEN 5 WHEN 'Sexta-feira' THEN 6
                    WHEN 'Sábado' THEN 7
                END;
        `);

    return result.recordset;
}

async function relatorioSalasPorcentagem(idProfessor) {
    const pool = await getPool();
    const result = await pool.request()
        .input('id_professor', sql.Int, idProfessor)
        .query(`
            SELECT TOP 5
                s.nome_sala,
                COUNT(*) AS quantidade_usos
            FROM agendamentos a
            JOIN Salas s ON a.id_sala = s.id_sala
            WHERE a.id_professor = @id_professor
            GROUP BY s.nome_sala
            ORDER BY quantidade_usos DESC;
        `);

    return {
        labels: result.recordset.map((item) => item.nome_sala),
        data: result.recordset.map((item) => item.quantidade_usos)
    };
}

module.exports = {
    horasAgendadasMes,
    agendaSemanalProfessor,
    agendaProfessorPorPeriodo,
    criarCompromissoAgendaProfessor,
    topSalasProfessor,
    professorDisponibilidade,
    relatorioHorasPorUc,
    relatorioUsoSalas,
    relatorioAgendamentosPeriodo,
    relatorioSalasPorcentagem
};