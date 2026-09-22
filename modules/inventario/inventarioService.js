const sql = require('mssql');
const config = require('../../dbConfig');

let poolPromise = null;

function getPool() {
    if (!poolPromise) {
        poolPromise = sql.connect(config).catch((error) => {
            poolPromise = null;
            throw error;
        });
    }

    return poolPromise;
}

function normalizeEquipmentUnitCode(value) {
    const text = String(value || '').trim().toUpperCase();
    if (!text) {
        return null;
    }

    const match = text.match(/(?:^UC)?\s*([0-9]{1,3})/);
    if (!match) {
        return null;
    }

    return match[1].padStart(3, '0');
}

function getEquipmentUnitCodes(req) {
    const units = Array.isArray(req.session?.user?.unidades) ? req.session.user.unidades : [];
    const normalized = units
        .map((unit) => normalizeEquipmentUnitCode(unit))
        .filter(Boolean);

    return Array.from(new Set(normalized));
}

function isAuthenticatedRequest(req) {
    return Boolean(req.session?.user);
}

function sanitizeComputerExposure(records, req) {
    if (isAuthenticatedRequest(req) || !Array.isArray(records)) {
        return records;
    }

    return records.map((item) => {
        const row = { ...item };

        if (Object.prototype.hasOwnProperty.call(row, 'endereco_ip')) row.endereco_ip = 'Oculto';
        if (Object.prototype.hasOwnProperty.call(row, 'endereco_mac')) row.endereco_mac = 'Oculto';
        if (Object.prototype.hasOwnProperty.call(row, 'SerialNumber')) row.SerialNumber = 'Oculto';
        if (Object.prototype.hasOwnProperty.call(row, 'nome_computador')) row.nome_computador = 'Oculto';
        if (Object.prototype.hasOwnProperty.call(row, 'last_logged_user')) row.last_logged_user = 'Oculto';
        if (Object.prototype.hasOwnProperty.call(row, 'network_adapters_details')) row.network_adapters_details = 'Oculto';

        if (Object.prototype.hasOwnProperty.call(row, 'ipAddress')) row.ipAddress = 'Oculto';
        if (Object.prototype.hasOwnProperty.call(row, 'serialNumber')) row.serialNumber = 'Oculto';
        if (Object.prototype.hasOwnProperty.call(row, 'nomeComputador')) row.nomeComputador = 'Oculto';
        if (Object.prototype.hasOwnProperty.call(row, 'lastLoggedUser')) row.lastLoggedUser = 'Oculto';

        return row;
    });
}

function buildComputerNameUnitFilterSql(req, request, computerNameExpression) {
    if (!isAuthenticatedRequest(req)) {
        return '1 = 1';
    }

    const allowedUnitCodes = getEquipmentUnitCodes(req);
    if (!allowedUnitCodes.length) {
        return '1 = 0';
    }

    const placeholders = allowedUnitCodes.map((_, index) => `@pcUnit${index}`).join(', ');
    allowedUnitCodes.forEach((code, index) => {
        request.input(`pcUnit${index}`, sql.NVarChar(3), code);
    });

    return `UPPER(ISNULL(${computerNameExpression}, '')) LIKE 'UC%' AND SUBSTRING(UPPER(ISNULL(${computerNameExpression}, '')), 3, 3) IN (${placeholders})`;
}

function sanitizeSerial(value) {
    return String(value || '')
        .trim()
        .replace(/[\\/]+/g, '_')
        .replace(/,+/g, '_')
        .replace(/^_+|_+$/g, '')
        .replace(/_+/g, '_');
}

function normalizeSerialForDb(value) {
    return String(value || '')
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '');
}

function isBlank(value) {
    return String(value || '').trim().length === 0;
}

function pickFirstNonBlank(values) {
    for (const value of values) {
        if (!isBlank(value)) {
            return String(value).trim();
        }
    }

    return null;
}

function getSalaComputerScopeConfig(tipoSala) {
    const normalized = String(tipoSala || '').trim().toLowerCase();

    if (normalized === 'academico') {
        return {
            tipoSala: normalized,
            tabelaSalas: 'Salas',
            tabelaRelacao: 'SalaComputadorAcademica'
        };
    }

    if (normalized === 'administrativa') {
        return {
            tipoSala: normalized,
            tabelaSalas: 'SalasAdministrativas',
            tabelaRelacao: 'SalaComputadorAdministrativa'
        };
    }

    return null;
}

async function getSalaComputersScope(req, idSalaParam, tipoSalaParam) {
    const idSala = parseInt(idSalaParam, 10);
    const configSala = getSalaComputerScopeConfig(tipoSalaParam);

    if (!Number.isInteger(idSala)) {
        return { statusCode: 400, body: { error: 'Sala invalida.' } };
    }

    if (!configSala) {
        return { statusCode: 400, body: { error: 'Tipo de sala invalido.' } };
    }

    const pool = await getPool();
    const result = await pool.request()
        .input('id_sala', sql.Int, idSala)
        .query(`
            SELECT TOP 1 id_sala, nome_sala, codigo_unidade
            FROM ${configSala.tabelaSalas}
            WHERE id_sala = @id_sala
        `);

    if (!result.recordset.length) {
        return { statusCode: 404, body: { error: 'Sala nao encontrada.' } };
    }

    if (req.session?.user?.permissao !== 'admin') {
        const allowedUnitCodes = getEquipmentUnitCodes(req);
        const roomUnitCode = normalizeEquipmentUnitCode(result.recordset[0].codigo_unidade);

        if (!allowedUnitCodes.length || !roomUnitCode || !allowedUnitCodes.includes(roomUnitCode)) {
            return { statusCode: 403, body: { error: 'Acesso negado para a sala selecionada.' } };
        }
    }

    return {
        statusCode: 200,
        body: {
            idSala,
            nomeSala: result.recordset[0].nome_sala,
            codigoUnidade: result.recordset[0].codigo_unidade,
            tipoSala: configSala.tipoSala,
            tabelaRelacao: configSala.tabelaRelacao
        }
    };
}

async function listarComputadoresAssociadosSala(idSala, tipoSala) {
    const configSala = getSalaComputerScopeConfig(tipoSala);
    if (!configSala) {
        return { statusCode: 400, body: 'Tipo de sala inválido.' };
    }

    const pool = await getPool();
    const result = await pool.request()
        .input('id_sala', sql.Int, idSala)
        .query(`
            SELECT
                c.id as id_computador,
                c.nome_computador,
                c.SerialNumber,
                c.endereco_mac,
                c.cpu_info,
                c.memoria_ram,
                c.endereco_ip,
                c.disco_info,
                c.patrimonio,
                c.cadastro_manual,
                c.last_logged_user,
                c.data_registro
            FROM ${configSala.tabelaRelacao} sc
            JOIN computadores c ON sc.id_computador = c.id
            WHERE sc.id_sala = @id_sala
        `);

    return { statusCode: 200, body: result.recordset };
}

async function cadastrarMonitor(body) {
    const { monitorId, modelo, polegadas, numero_serie, patrimonio, salaId } = body;

    if (!modelo || !polegadas || !numero_serie || !patrimonio) {
        return { statusCode: 400, body: { error: 'Todos os campos são obrigatórios.' } };
    }

    const pool = await getPool();
    const monitorIdNumerico = monitorId ? parseInt(monitorId, 10) : null;
    const salaIdNumerico = salaId ? parseInt(salaId, 10) : null;
    const modeloLimpo = String(modelo).trim();
    const numeroSerieLimpo = String(numero_serie).trim();
    const patrimonioLimpo = String(patrimonio).trim();

    const checkResult = await pool.request()
        .input('numero_serie', sql.NVarChar, numeroSerieLimpo)
        .input('patrimonio', sql.NVarChar, patrimonioLimpo)
        .query(`
            SELECT id, numero_serie, patrimonio
            FROM monitores
            WHERE numero_serie = @numero_serie OR patrimonio = @patrimonio
        `);

    const monitorEncontradoPorPatrimonio = checkResult.recordset.find((item) => String(item.patrimonio || '').trim() === patrimonioLimpo);
    const monitorEncontradoPorSerie = checkResult.recordset.find((item) => String(item.numero_serie || '').trim() === numeroSerieLimpo);

    if (
        monitorEncontradoPorPatrimonio
        && monitorEncontradoPorSerie
        && Number(monitorEncontradoPorPatrimonio.id) !== Number(monitorEncontradoPorSerie.id)
    ) {
        return { statusCode: 409, body: { error: 'Ja existe conflito entre patrimonio e numero de serie em registros diferentes.' } };
    }

    const monitorExistente = monitorIdNumerico
        ? { id: monitorIdNumerico }
        : monitorEncontradoPorPatrimonio || monitorEncontradoPorSerie || null;

    let monitorIdFinal = monitorExistente?.id || null;
    let mensagem = 'Monitor cadastrado com sucesso!';

    if (monitorIdFinal) {
        const updateResult = await pool.request()
            .input('id', sql.Int, monitorIdFinal)
            .input('modelo', sql.NVarChar, modeloLimpo)
            .input('polegadas', sql.Int, polegadas)
            .input('numero_serie', sql.NVarChar, numeroSerieLimpo)
            .input('patrimonio', sql.NVarChar, patrimonioLimpo)
            .query(`
                UPDATE monitores
                SET modelo = @modelo,
                    polegadas = @polegadas,
                    numero_serie = @numero_serie,
                    patrimonio = @patrimonio
                WHERE id = @id
            `);

        if (updateResult.rowsAffected[0] === 0) {
            return { statusCode: 404, body: { error: 'Monitor nao encontrado para atualizacao.' } };
        }

        mensagem = 'Monitor existente atualizado com sucesso!';
    } else {
        const insertResult = await pool.request()
            .input('modelo', sql.NVarChar, modeloLimpo)
            .input('polegadas', sql.Int, polegadas)
            .input('numero_serie', sql.NVarChar, numeroSerieLimpo)
            .input('patrimonio', sql.NVarChar, patrimonioLimpo)
            .input('data_registro', sql.DateTime, new Date())
            .query(`
                INSERT INTO monitores (modelo, polegadas, numero_serie, patrimonio, data_registro)
                OUTPUT INSERTED.id
                VALUES (@modelo, @polegadas, @numero_serie, @patrimonio, @data_registro)
            `);

        monitorIdFinal = insertResult.recordset[0].id;
    }

    if (salaIdNumerico) {
        await pool.request()
            .input('id_monitor', sql.Int, monitorIdFinal)
            .query('DELETE FROM MonitorSala WHERE id_monitor = @id_monitor');

        await pool.request()
            .input('id_sala', sql.Int, salaIdNumerico)
            .input('id_monitor', sql.Int, monitorIdFinal)
            .query('INSERT INTO MonitorSala (id_sala, id_monitor) VALUES (@id_sala, @id_monitor)');

        mensagem = monitorExistente
            ? 'Monitor existente atualizado e vinculado a sala selecionada com sucesso!'
            : 'Monitor cadastrado e associado com sucesso!';
    }

    return {
        statusCode: monitorExistente ? 200 : 201,
        body: {
            id: monitorIdFinal,
            reused: Boolean(monitorExistente),
            message: mensagem
        }
    };
}

async function cadastrarComputadorManual(body) {
    const {
        nome_computador,
        endereco_mac,
        cpu_info,
        memoria_ram,
        disco_info,
        SerialNumber,
        endereco_ip,
        patrimonio,
        salaId,
        tipoSala
    } = body;

    const patrimonioLimpo = String(patrimonio || '').trim();
    const salaIdNumerico = parseInt(salaId, 10);

    if (!patrimonioLimpo) {
        return { statusCode: 400, body: { error: 'Patrimonio e obrigatorio.' } };
    }

    if (!Number.isInteger(salaIdNumerico)) {
        return { statusCode: 400, body: { error: 'Sala obrigatoria para vinculacao.' } };
    }

    if (tipoSala !== 'academico' && tipoSala !== 'administrativa') {
        return { statusCode: 400, body: { error: 'Tipo de sala invalido.' } };
    }

    const serialLimpo = isBlank(SerialNumber) ? null : normalizeSerialForDb(SerialNumber);
    if (!isBlank(SerialNumber) && !serialLimpo) {
        return { statusCode: 400, body: { error: 'Serial informado e invalido.' } };
    }

    const pool = await getPool();
    const tabelaSalas = tipoSala === 'administrativa' ? 'SalasAdministrativas' : 'Salas';
    const tabelaAssociacao = tipoSala === 'administrativa' ? 'SalaComputadorAdministrativa' : 'SalaComputadorAcademica';

    const salaResult = await pool.request()
        .input('id_sala', sql.Int, salaIdNumerico)
        .query(`SELECT TOP 1 id_sala FROM ${tabelaSalas} WHERE id_sala = @id_sala`);

    if (!salaResult.recordset.length) {
        return { statusCode: 404, body: { error: 'Sala de destino nao encontrada.' } };
    }

    const duplicidadeResult = await pool.request()
        .input('patrimonio', sql.NVarChar, patrimonioLimpo)
        .input('serial', sql.NVarChar, serialLimpo || '')
        .query(`
            SELECT TOP 1 id
            FROM computadores
            WHERE patrimonio = @patrimonio
               OR (@serial <> '' AND UPPER(REPLACE(REPLACE(REPLACE(REPLACE(ISNULL(SerialNumber, ''), '/', ''), '\\', ''), '$', ''), ' ', '')) = @serial)
        `);

    if (duplicidadeResult.recordset.length) {
        return { statusCode: 409, body: { error: 'Ja existe computador com este patrimonio ou serial.' } };
    }

    const insertResult = await pool.request()
        .input('nome_computador', sql.NVarChar, isBlank(nome_computador) ? null : String(nome_computador).trim())
        .input('endereco_mac', sql.NVarChar, isBlank(endereco_mac) ? null : String(endereco_mac).trim())
        .input('cpu_info', sql.NVarChar, isBlank(cpu_info) ? null : String(cpu_info).trim())
        .input('memoria_ram', sql.NVarChar, isBlank(memoria_ram) ? null : String(memoria_ram).trim())
        .input('disco_info', sql.NVarChar, isBlank(disco_info) ? null : String(disco_info).trim())
        .input('SerialNumber', sql.NVarChar, serialLimpo)
        .input('endereco_ip', sql.NVarChar, isBlank(endereco_ip) ? null : String(endereco_ip).trim())
        .input('patrimonio', sql.NVarChar, patrimonioLimpo)
        .query(`
            INSERT INTO computadores (
                nome_computador,
                endereco_mac,
                cpu_info,
                memoria_ram,
                disco_info,
                SerialNumber,
                endereco_ip,
                patrimonio,
                cadastro_manual,
                data_registro
            )
            OUTPUT INSERTED.id
            VALUES (
                @nome_computador,
                @endereco_mac,
                @cpu_info,
                @memoria_ram,
                @disco_info,
                @SerialNumber,
                @endereco_ip,
                @patrimonio,
                1,
                SYSDATETIME()
            )
        `);

    const computadorId = insertResult.recordset[0].id;

    await pool.request()
        .input('id_computador', sql.Int, computadorId)
        .query('DELETE FROM SalaComputadorAcademica WHERE id_computador = @id_computador; DELETE FROM SalaComputadorAdministrativa WHERE id_computador = @id_computador;');

    await pool.request()
        .input('id_sala', sql.Int, salaIdNumerico)
        .input('id_computador', sql.Int, computadorId)
        .query(`INSERT INTO ${tabelaAssociacao} (id_sala, id_computador) VALUES (@id_sala, @id_computador)`);

    return {
        statusCode: 201,
        body: { id: computadorId, message: 'Computador cadastrado manualmente e vinculado com sucesso.' }
    };
}

async function monitorPorPatrimonio(patrimonioParam) {
    const patrimonio = String(patrimonioParam || '').trim();

    if (!patrimonio) {
        return { statusCode: 400, body: { error: 'Patrimonio e obrigatorio.' } };
    }

    const pool = await getPool();
    const result = await pool.request()
        .input('patrimonio', sql.NVarChar, patrimonio)
        .query(`
            SELECT TOP 1
                m.id,
                m.modelo,
                m.polegadas,
                m.numero_serie,
                m.patrimonio,
                ms.id_sala,
                s.nome_sala
            FROM monitores m
            LEFT JOIN MonitorSala ms ON ms.id_monitor = m.id
            LEFT JOIN Salas s ON s.id_sala = ms.id_sala
            WHERE m.patrimonio = @patrimonio
            ORDER BY m.id DESC
        `);

    if (!result.recordset.length) {
        return { statusCode: 404, body: { error: 'Monitor nao encontrado.' } };
    }

    return { statusCode: 200, body: result.recordset[0] };
}

async function editarMonitor(id, body) {
    const { modelo, polegadas, numero_serie, patrimonio } = body;
    const pool = await getPool();
    const result = await pool.request()
        .input('id', sql.Int, id)
        .input('modelo', sql.NVarChar, String(modelo || '').trim())
        .input('polegadas', sql.Int, polegadas)
        .input('numero_serie', sql.NVarChar, String(numero_serie || '').trim())
        .input('patrimonio', sql.NVarChar, String(patrimonio || '').trim())
        .query(`
            UPDATE monitores
            SET modelo = @modelo,
                polegadas = @polegadas,
                numero_serie = @numero_serie,
                patrimonio = @patrimonio
            WHERE id = @id
        `);

    if (result.rowsAffected[0] === 0) {
        return { statusCode: 404, body: 'Monitor não encontrado.' };
    }

    return { statusCode: 200, body: 'Monitor atualizado com sucesso.' };
}

async function excluirMonitor(id) {
    const monitorId = parseInt(id, 10);

    if (Number.isNaN(monitorId)) {
        return { statusCode: 400, body: 'ID do monitor inválido.' };
    }

    const pool = await getPool();
    const checkAssociation = await pool.request()
        .input('id_monitor', sql.Int, monitorId)
        .query('SELECT COUNT(*) AS count FROM MonitorSala WHERE id_monitor = @id_monitor');

    if (checkAssociation.recordset[0].count > 0) {
        return {
            statusCode: 409,
            body: 'O monitor não pode ser excluído permanentemente porque está ASSOCIADO a uma sala. Primeiro, remova-o da sala.'
        };
    }

    const result = await pool.request()
        .input('id', sql.Int, monitorId)
        .query('DELETE FROM monitores WHERE id = @id');

    if (result.rowsAffected[0] === 0) {
        return { statusCode: 404, body: 'Monitor não encontrado para exclusão.' };
    }

    return { statusCode: 200 };
}

async function associarComputador(req, body) {
    const { salaId, computadorId, tipoSala } = body;

    if (!salaId || !computadorId || !tipoSala) {
        return { statusCode: 400, body: 'ID da sala, ID do computador e tipo da sala são obrigatórios.' };
    }

    const salaIdNumero = Number(salaId);
    const computadorIdNumero = Number(computadorId);

    if (!Number.isInteger(salaIdNumero) || !Number.isInteger(computadorIdNumero)) {
        return { statusCode: 400, body: 'ID da sala e ID do computador devem ser numéricos.' };
    }

    const tabelaDestino = tipoSala === 'academico'
        ? 'SalaComputadorAcademica'
        : tipoSala === 'administrativa'
            ? 'SalaComputadorAdministrativa'
            : null;

    if (!tabelaDestino) {
        return { statusCode: 400, body: 'Tipo de sala inválido.' };
    }

    const pool = await getPool();
    const transaction = new sql.Transaction(pool);

    try {
        await transaction.begin();

        const request = transaction.request();
        const computadorAtualResult = await request
            .input('computadorId', sql.Int, computadorIdNumero)
            .query(`
                SELECT TOP 1
                    c.id,
                    c.nome_computador,
                    c.SerialNumber,
                    c.patrimonio,
                    sca.id_sala AS sala_academica_id,
                    sa.nome_sala AS sala_academica_nome,
                    sa.codigo_unidade AS sala_academica_unidade,
                    scad.id_sala AS sala_administrativa_id,
                    sad.nome_sala AS sala_administrativa_nome,
                    sad.codigo_unidade AS sala_administrativa_unidade
                FROM computadores c
                LEFT JOIN SalaComputadorAcademica sca ON sca.id_computador = c.id
                LEFT JOIN Salas sa ON sa.id_sala = sca.id_sala
                LEFT JOIN SalaComputadorAdministrativa scad ON scad.id_computador = c.id
                LEFT JOIN SalasAdministrativas sad ON sad.id_sala = scad.id_sala
                WHERE c.id = @computadorId;
            `);

        const computadorAtual = computadorAtualResult.recordset[0] || {};
        const salaAcademicaAtual = computadorAtual.sala_academica_id ? Number(computadorAtual.sala_academica_id) : null;
        const salaAdministrativaAtual = computadorAtual.sala_administrativa_id ? Number(computadorAtual.sala_administrativa_id) : null;
        const origem = salaAcademicaAtual
            ? {
                id: salaAcademicaAtual,
                type: 'academico',
                name: computadorAtual.sala_academica_nome,
                unidade: computadorAtual.sala_academica_unidade
            }
            : salaAdministrativaAtual
                ? {
                    id: salaAdministrativaAtual,
                    type: 'administrativa',
                    name: computadorAtual.sala_administrativa_nome,
                    unidade: computadorAtual.sala_administrativa_unidade
                }
                : null;

        const jaNaSalaDestino = (tipoSala === 'academico' && salaAcademicaAtual === salaIdNumero)
            || (tipoSala === 'administrativa' && salaAdministrativaAtual === salaIdNumero);

        if (jaNaSalaDestino) {
            await transaction.commit();
            return { statusCode: 200, body: { message: 'Computador já está vinculado nesta sala.', moved: false } };
        }

        const destinoQuery = tipoSala === 'academico'
            ? 'SELECT TOP 1 nome_sala, codigo_unidade FROM Salas WHERE id_sala = @salaId'
            : 'SELECT TOP 1 nome_sala, codigo_unidade FROM SalasAdministrativas WHERE id_sala = @salaId';

        const destinoResult = await transaction.request()
            .input('salaId', sql.Int, salaIdNumero)
            .query(destinoQuery);

        const destinoRow = destinoResult.recordset[0] || {};
        const destino = {
            id: salaIdNumero,
            type: tipoSala,
            name: destinoRow.nome_sala || null,
            unidade: destinoRow.codigo_unidade || null
        };

        await transaction.request()
            .input('computadorId', sql.Int, computadorIdNumero)
            .query('DELETE FROM SalaComputadorAcademica WHERE id_computador = @computadorId; DELETE FROM SalaComputadorAdministrativa WHERE id_computador = @computadorId;');

        await transaction.request()
            .input('salaId', sql.Int, salaIdNumero)
            .input('computadorId', sql.Int, computadorIdNumero)
            .query(`
                INSERT INTO ${tabelaDestino} (id_sala, id_computador)
                SELECT @salaId, @computadorId
                WHERE NOT EXISTS (
                    SELECT 1
                    FROM ${tabelaDestino}
                    WHERE id_sala = @salaId
                      AND id_computador = @computadorId
                );
            `);

        const acao = origem ? 'mover' : 'vincular';
        const usuarioId = req.session?.user?.id_professor || req.session?.user?.id || null;
        const usuarioNome = req.session?.user?.nome || req.session?.user?.name || null;

        await transaction.request()
            .input('tipo_equipamento', sql.NVarChar(20), 'computador')
            .input('id_equipamento', sql.Int, computadorIdNumero)
            .input('serial_number', sql.NVarChar(200), computadorAtual.SerialNumber || null)
            .input('acao', sql.NVarChar(50), acao)
            .input('nome_antigo', sql.NVarChar(255), computadorAtual.nome_computador || null)
            .input('nome_novo', sql.NVarChar(255), computadorAtual.nome_computador || null)
            .input('patrimonio_antigo', sql.NVarChar(100), computadorAtual.patrimonio || null)
            .input('patrimonio_novo', sql.NVarChar(100), computadorAtual.patrimonio || null)
            .input('sala_origem_id', sql.Int, origem?.id || null)
            .input('sala_origem_tipo', sql.NVarChar(20), origem?.type || null)
            .input('sala_origem_nome', sql.NVarChar(255), origem?.name || null)
            .input('sala_destino_id', sql.Int, destino.id)
            .input('sala_destino_tipo', sql.NVarChar(20), destino.type)
            .input('sala_destino_nome', sql.NVarChar(255), destino.name)
            .input('usuario_id', sql.Int, usuarioId)
            .input('usuario_nome', sql.NVarChar(255), usuarioNome)
            .query(`
                INSERT INTO dbo.EquipamentoHistorico (
                    tipo_equipamento,
                    id_equipamento,
                    serial_number,
                    acao,
                    nome_antigo,
                    nome_novo,
                    patrimonio_antigo,
                    patrimonio_novo,
                    sala_origem_id,
                    sala_origem_tipo,
                    sala_origem_nome,
                    sala_destino_id,
                    sala_destino_tipo,
                    sala_destino_nome,
                    usuario_id,
                    usuario_nome
                ) VALUES (
                    @tipo_equipamento,
                    @id_equipamento,
                    @serial_number,
                    @acao,
                    @nome_antigo,
                    @nome_novo,
                    @patrimonio_antigo,
                    @patrimonio_novo,
                    @sala_origem_id,
                    @sala_origem_tipo,
                    @sala_origem_nome,
                    @sala_destino_id,
                    @sala_destino_tipo,
                    @sala_destino_nome,
                    @usuario_id,
                    @usuario_nome
                );
            `);

        await transaction.commit();
        return {
            statusCode: 200,
            body: {
                message: 'Computador associado/movido com sucesso.',
                moved: Boolean(origem)
            }
        };
    } catch (error) {
        try {
            await transaction.rollback();
        } catch (_) {
            // no-op
        }

        throw error;
    }
}

async function registrarEquipamentoHistorico(transaction, evento) {
    const {
        tipo_equipamento = 'computador',
        id_equipamento,
        serial_number = null,
        acao,
        nome_antigo = null,
        nome_novo = null,
        patrimonio_antigo = null,
        patrimonio_novo = null,
        sala_origem_id = null,
        sala_origem_tipo = null,
        sala_origem_nome = null,
        sala_destino_id = null,
        sala_destino_tipo = null,
        sala_destino_nome = null,
        usuario_id = null,
        usuario_nome = null
    } = evento;

    await transaction.request()
        .input('tipo_equipamento', sql.NVarChar(20), tipo_equipamento)
        .input('id_equipamento', sql.Int, id_equipamento)
        .input('serial_number', sql.NVarChar(200), serial_number)
        .input('acao', sql.NVarChar(50), acao)
        .input('nome_antigo', sql.NVarChar(255), nome_antigo)
        .input('nome_novo', sql.NVarChar(255), nome_novo)
        .input('patrimonio_antigo', sql.NVarChar(100), patrimonio_antigo)
        .input('patrimonio_novo', sql.NVarChar(100), patrimonio_novo)
        .input('sala_origem_id', sql.Int, sala_origem_id)
        .input('sala_origem_tipo', sql.NVarChar(20), sala_origem_tipo)
        .input('sala_origem_nome', sql.NVarChar(255), sala_origem_nome)
        .input('sala_destino_id', sql.Int, sala_destino_id)
        .input('sala_destino_tipo', sql.NVarChar(20), sala_destino_tipo)
        .input('sala_destino_nome', sql.NVarChar(255), sala_destino_nome)
        .input('usuario_id', sql.Int, usuario_id)
        .input('usuario_nome', sql.NVarChar(255), usuario_nome)
        .query(`
            INSERT INTO dbo.EquipamentoHistorico (
                tipo_equipamento,
                id_equipamento,
                serial_number,
                acao,
                nome_antigo,
                nome_novo,
                patrimonio_antigo,
                patrimonio_novo,
                sala_origem_id,
                sala_origem_tipo,
                sala_origem_nome,
                sala_destino_id,
                sala_destino_tipo,
                sala_destino_nome,
                usuario_id,
                usuario_nome
            ) VALUES (
                @tipo_equipamento,
                @id_equipamento,
                @serial_number,
                @acao,
                @nome_antigo,
                @nome_novo,
                @patrimonio_antigo,
                @patrimonio_novo,
                @sala_origem_id,
                @sala_origem_tipo,
                @sala_origem_nome,
                @sala_destino_id,
                @sala_destino_tipo,
                @sala_destino_nome,
                @usuario_id,
                @usuario_nome
            );
        `);
}

async function computadoresAssociados(idSala, tipoSala) {
    return listarComputadoresAssociadosSala(idSala, tipoSala);
}

async function infoComputadores(req) {
    const pool = await getPool();
    const request = pool.request();
    const whereUnitFilter = buildComputerNameUnitFilterSql(req, request, '[nome_computador]');

    const result = await request.query(`
        WITH base AS (
            SELECT
                c.[id],
                c.[nome_computador],
                c.[SerialNumber],
                c.[endereco_mac],
                c.[patrimonio],
                c.[data_registro],
                c.[nomes_programas],
                c.[cpu_info],
                c.[memoria_ram],
                c.[endereco_ip],
                c.[last_logged_user],
                c.[network_adapters_details],
                c.[disco_info],
                c.[cadastro_manual],
                COALESCE(sa.id_sala, sad.id_sala) AS id_sala,
                COALESCE(sa.nome_sala, sad.nome_sala) AS nome_sala,
                CASE
                    WHEN sa.id_sala IS NOT NULL THEN 'academico'
                    WHEN sad.id_sala IS NOT NULL THEN 'administrativa'
                    ELSE NULL
                END AS tipo_sala_assoc,
                UPPER(REPLACE(REPLACE(REPLACE(REPLACE(ISNULL(c.[SerialNumber], ''), '/', ''), '\\', ''), '$', ''), ' ', '')) AS serial_normalizado
            FROM [dbo].[computadores] c
            LEFT JOIN SalaComputadorAcademica sca ON sca.id_computador = c.id
            LEFT JOIN Salas sa ON sa.id_sala = sca.id_sala
            LEFT JOIN SalaComputadorAdministrativa scad ON scad.id_computador = c.id
            LEFT JOIN SalasAdministrativas sad ON sad.id_sala = scad.id_sala
        ),
        ranked AS (
            SELECT
                b.*, 
                ROW_NUMBER() OVER (
                    PARTITION BY CASE WHEN b.serial_normalizado = '' THEN CONCAT('__ID__', CAST(b.id AS VARCHAR(20))) ELSE b.serial_normalizado END
                    ORDER BY
                        CASE WHEN b.[SerialNumber] LIKE '%/%' OR b.[SerialNumber] LIKE '%\\%' THEN 1 ELSE 0 END ASC,
                        ISNULL(b.[data_registro], '19000101') DESC,
                        b.id DESC
                ) AS rn
            FROM base b
        )
        SELECT TOP (1000)
            [id],
            [nome_computador],
            [SerialNumber],
            [endereco_mac],
            [patrimonio],
            [data_registro],
            [nomes_programas],
            [cpu_info],
            [memoria_ram],
            [endereco_ip],
            [last_logged_user],
            [network_adapters_details],
            [disco_info],
            [cadastro_manual],
            [id_sala],
            [nome_sala],
            [tipo_sala_assoc]
        FROM ranked
        WHERE rn = 1
          AND (${whereUnitFilter})
        ORDER BY ISNULL([data_registro], '19000101') DESC, id DESC
    `);

    return sanitizeComputerExposure(result.recordset, req);
}

async function deduplicarComputadores() {
    const pool = await getPool();
    const transaction = new sql.Transaction(pool);
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);

    try {
        const duplicatesResult = await new sql.Request(transaction).query(`
            WITH base AS (
                SELECT
                    c.[id],
                    c.[SerialNumber],
                    c.[patrimonio],
                    c.[nome_computador],
                    c.[endereco_mac],
                    c.[cpu_info],
                    c.[memoria_ram],
                    c.[disco_info],
                    c.[endereco_ip],
                    c.[last_logged_user],
                    c.[network_adapters_details],
                    c.[nomes_programas],
                    c.[data_registro],
                    UPPER(REPLACE(REPLACE(REPLACE(REPLACE(ISNULL(c.[SerialNumber], ''), '/', ''), '\\', ''), '$', ''), ' ', '')) AS serial_normalizado
                FROM computadores c
            ),
            ranked AS (
                SELECT
                    b.*,
                    ROW_NUMBER() OVER (
                        PARTITION BY b.serial_normalizado
                        ORDER BY
                            CASE WHEN b.[SerialNumber] LIKE '%/%' OR b.[SerialNumber] LIKE '%\\%' THEN 1 ELSE 0 END ASC,
                            ISNULL(b.[data_registro], '19000101') DESC,
                            b.id DESC
                    ) AS rn_keep,
                    ROW_NUMBER() OVER (
                        PARTITION BY b.serial_normalizado
                        ORDER BY ISNULL(b.[data_registro], '19000101') DESC, b.id DESC
                    ) AS rn_latest
                FROM base b
                WHERE b.serial_normalizado <> ''
            )
            SELECT *
            FROM ranked
            WHERE serial_normalizado IN (
                SELECT serial_normalizado
                FROM ranked
                GROUP BY serial_normalizado
                HAVING COUNT(*) > 1
            )
            ORDER BY serial_normalizado, rn_keep, rn_latest, id
        `);

        const groups = new Map();
        for (const row of duplicatesResult.recordset) {
            if (!groups.has(row.serial_normalizado)) {
                groups.set(row.serial_normalizado, []);
            }
            groups.get(row.serial_normalizado).push(row);
        }

        let gruposAjustados = 0;
        let atualizados = 0;
        let removidos = 0;

        for (const [serialNormalizado, rows] of groups.entries()) {
            const keeper = rows.find((row) => Number(row.rn_keep) === 1);
            const latest = rows.find((row) => Number(row.rn_latest) === 1) || keeper;

            if (!keeper) {
                continue;
            }

            const patrimonioEscolhido = isBlank(keeper.patrimonio)
                ? pickFirstNonBlank(rows.map((row) => row.patrimonio))
                : String(keeper.patrimonio || '').trim();

            const serialLimpo = normalizeSerialForDb(keeper.SerialNumber || latest.SerialNumber || serialNormalizado);

            await new sql.Request(transaction)
                .input('id', sql.Int, keeper.id)
                .input('serialLimpo', sql.NVarChar, serialLimpo)
                .input('nome_computador', sql.NVarChar, pickFirstNonBlank([latest.nome_computador, keeper.nome_computador]))
                .input('endereco_mac', sql.NVarChar, pickFirstNonBlank([latest.endereco_mac, keeper.endereco_mac]))
                .input('cpu_info', sql.NVarChar, pickFirstNonBlank([latest.cpu_info, keeper.cpu_info]))
                .input('memoria_ram', sql.NVarChar, pickFirstNonBlank([latest.memoria_ram, keeper.memoria_ram]))
                .input('disco_info', sql.NVarChar, pickFirstNonBlank([latest.disco_info, keeper.disco_info]))
                .input('endereco_ip', sql.NVarChar, pickFirstNonBlank([latest.endereco_ip, keeper.endereco_ip]))
                .input('last_logged_user', sql.NVarChar, pickFirstNonBlank([latest.last_logged_user, keeper.last_logged_user]))
                .input('network_adapters_details', sql.NVarChar, pickFirstNonBlank([latest.network_adapters_details, keeper.network_adapters_details]))
                .input('nomes_programas', sql.NVarChar, pickFirstNonBlank([latest.nomes_programas, keeper.nomes_programas]))
                .input('patrimonio', sql.NVarChar, patrimonioEscolhido)
                .query(`
                    UPDATE computadores
                    SET
                        SerialNumber = @serialLimpo,
                        nome_computador = COALESCE(@nome_computador, nome_computador),
                        endereco_mac = COALESCE(@endereco_mac, endereco_mac),
                        cpu_info = COALESCE(@cpu_info, cpu_info),
                        memoria_ram = COALESCE(@memoria_ram, memoria_ram),
                        disco_info = COALESCE(@disco_info, disco_info),
                        endereco_ip = COALESCE(@endereco_ip, endereco_ip),
                        last_logged_user = COALESCE(@last_logged_user, last_logged_user),
                        network_adapters_details = COALESCE(@network_adapters_details, network_adapters_details),
                        nomes_programas = COALESCE(@nomes_programas, nomes_programas),
                        patrimonio = CASE
                            WHEN NULLIF(LTRIM(RTRIM(ISNULL(patrimonio, ''))), '') IS NULL
                                THEN COALESCE(@patrimonio, patrimonio)
                            ELSE patrimonio
                        END,
                        data_registro = SYSDATETIME()
                    WHERE id = @id
                `);

            atualizados += 1;

            const idsToDelete = rows
                .filter((row) => row.id !== keeper.id)
                .map((row) => Number(row.id))
                .filter(Number.isFinite);

            for (const id of idsToDelete) {
                await new sql.Request(transaction)
                    .input('id_computador_antigo', sql.Int, id)
                    .input('id_computador_novo', sql.Int, keeper.id)
                    .query(`
                        INSERT INTO SalaComputadorAcademica (id_sala, id_computador)
                        SELECT sc.id_sala, @id_computador_novo
                        FROM SalaComputadorAcademica sc
                        WHERE sc.id_computador = @id_computador_antigo
                          AND NOT EXISTS (
                              SELECT 1
                              FROM SalaComputadorAcademica existe
                              WHERE existe.id_sala = sc.id_sala
                                AND existe.id_computador = @id_computador_novo
                          )
                    `);

                await new sql.Request(transaction)
                    .input('id_computador_antigo', sql.Int, id)
                    .query('DELETE FROM SalaComputadorAcademica WHERE id_computador = @id_computador_antigo');

                await new sql.Request(transaction)
                    .input('id_computador_antigo', sql.Int, id)
                    .input('id_computador_novo', sql.Int, keeper.id)
                    .query(`
                        INSERT INTO SalaComputadorAdministrativa (id_sala, id_computador)
                        SELECT sc.id_sala, @id_computador_novo
                        FROM SalaComputadorAdministrativa sc
                        WHERE sc.id_computador = @id_computador_antigo
                          AND NOT EXISTS (
                              SELECT 1
                              FROM SalaComputadorAdministrativa existe
                              WHERE existe.id_sala = sc.id_sala
                                AND existe.id_computador = @id_computador_novo
                          )
                    `);

                await new sql.Request(transaction)
                    .input('id_computador_antigo', sql.Int, id)
                    .query('DELETE FROM SalaComputadorAdministrativa WHERE id_computador = @id_computador_antigo');

                await new sql.Request(transaction)
                    .input('id', sql.Int, id)
                    .query('DELETE FROM computadores WHERE id = @id');

                removidos += 1;
            }

            gruposAjustados += 1;
        }

        await transaction.commit();

        return {
            message: 'Deduplicação concluída com sucesso.',
            gruposAjustados,
            atualizados,
            removidos
        };
    } catch (error) {
        try {
            await transaction.rollback();
        } catch (_) {
            // no-op
        }

        throw error;
    }
}

async function desassociarComputador(idComputador, idSala, tipoSala) {
    let query;

    if (tipoSala === 'academico') {
        query = 'DELETE FROM SalaComputadorAcademica WHERE id_computador = @id_computador AND id_sala = @id_sala';
    } else if (tipoSala === 'administrativa') {
        query = 'DELETE FROM SalaComputadorAdministrativa WHERE id_computador = @id_computador AND id_sala = @id_sala';
    } else {
        return { statusCode: 400, body: 'Tipo de sala inválido.' };
    }

    const pool = await getPool();
    await pool.request()
        .input('id_computador', sql.Int, idComputador)
        .input('id_sala', sql.Int, idSala)
        .query(query);

    return { statusCode: 200 };
}

async function listarMonitores() {
    const pool = await getPool();
    const result = await pool.request().query(`
        SELECT
            m.id,
            m.modelo,
            m.polegadas,
            m.numero_serie,
            m.patrimonio,
            m.data_registro,
            ms.id_sala,
            s.nome_sala,
            'academico' AS tipo_sala_assoc
        FROM monitores m
        LEFT JOIN MonitorSala ms ON m.id = ms.id_monitor
        LEFT JOIN Salas s ON s.id_sala = ms.id_sala;
    `);

    return result.recordset;
}

async function monitoresAssociadosAll() {
    const pool = await getPool();
    const result = await pool.request().query('SELECT DISTINCT id_monitor FROM MonitorSala');
    return result.recordset.map((record) => record.id_monitor);
}

async function monitoresAssociados(idSala) {
    const pool = await getPool();
    const result = await pool.request()
        .input('id_sala', sql.Int, idSala)
        .query(`
            SELECT
                m.id,
                m.modelo,
                m.polegadas,
                m.patrimonio,
                m.numero_serie
            FROM MonitorSala ms
            JOIN monitores m ON ms.id_monitor = m.id
            WHERE ms.id_sala = @id_sala
        `);

    return result.recordset;
}

async function desassociarMonitor(monitorId, salaId) {
    const pool = await getPool();
    await pool.request()
        .input('id_monitor', sql.Int, monitorId)
        .input('id_sala', sql.Int, salaId)
        .query('DELETE FROM MonitorSala WHERE id_monitor = @id_monitor AND id_sala = @id_sala');
}

async function associarMonitor(body) {
    const { salaId, monitorId } = body;

    if (!salaId || !monitorId) {
        return { statusCode: 400, body: 'ID da sala e do monitor são obrigatórios.' };
    }

    const pool = await getPool();
    const transaction = new sql.Transaction(pool);

    try {
        await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);

        const request = new sql.Request(transaction)
            .input('id_sala', sql.Int, salaId)
            .input('id_monitor', sql.Int, monitorId);

        await request.query(`
            DELETE FROM MonitorSala
            WHERE id_monitor = @id_monitor
              AND id_sala <> @id_sala;

            IF NOT EXISTS (
                SELECT 1
                FROM MonitorSala
                WHERE id_monitor = @id_monitor
                  AND id_sala = @id_sala
            )
            BEGIN
                INSERT INTO MonitorSala (id_sala, id_monitor)
                VALUES (@id_sala, @id_monitor);
            END
        `);

        await transaction.commit();
        return { statusCode: 200 };
    } catch (error) {
        if (transaction._aborted !== true) {
            await transaction.rollback().catch(() => {});
        }

        throw error;
    }
}

async function inventarioComputadores(req) {
    const pool = await getPool();
    const request = pool.request();
    const whereUnitFilter = buildComputerNameUnitFilterSql(req, request, 'nome_computador');

    const result = await request.query(`
        SELECT
            SerialNumber as serialNumber,
            nome_computador as nomeComputador,
            endereco_ip as ipAddress,
            last_logged_user as lastLoggedUser
        FROM computadores
        WHERE ${whereUnitFilter}
    `);

    const inventoryFromDb = result.recordset;

    return inventoryFromDb.map((pc) => ({
        ...pc,
        isConnected: false
    }));
}

async function patchPatrimonioPorSerial(req, serialParam, patrimonio) {
    const serialNormalizado = normalizeSerialForDb(serialParam);

    if (!serialNormalizado) {
        return { statusCode: 400, body: { error: 'Serial é obrigatório.' } };
    }

    if (patrimonio === undefined || patrimonio === null) {
        return { statusCode: 400, body: { error: 'patrimonio é obrigatório.' } };
    }

    const patrimonioNovo = String(patrimonio).trim();
    const pool = await getPool();
    const transaction = new sql.Transaction(pool);

    try {
        await transaction.begin();

        const selectResult = await transaction.request()
            .input('serialNormalizado', sql.NVarChar, serialNormalizado)
            .query(`
                SELECT TOP 1 id, nome_computador, patrimonio, SerialNumber
                FROM computadores
                WHERE UPPER(REPLACE(REPLACE(REPLACE(REPLACE(ISNULL(SerialNumber, ''), '/', ''), '\\', ''), '$', ''), ' ', '')) = @serialNormalizado
            `);

        if (!selectResult.recordset.length) {
            await transaction.rollback();
            return { statusCode: 404, body: { error: 'Computador não encontrado.' } };
        }

        const computador = selectResult.recordset[0];
        const patrimonioAntigo = computador.patrimonio || null;
        const nomeAntigo = computador.nome_computador || null;

        const updateResult = await transaction.request()
            .input('serialNormalizado', sql.NVarChar, serialNormalizado)
            .input('patrimonio', sql.NVarChar, patrimonioNovo)
            .query(`
                UPDATE computadores
                SET patrimonio = @patrimonio
                WHERE UPPER(REPLACE(REPLACE(REPLACE(REPLACE(ISNULL(SerialNumber, ''), '/', ''), '\\', ''), '$', ''), ' ', '')) = @serialNormalizado
            `);

        if (updateResult.rowsAffected[0] === 0) {
            await transaction.rollback();
            return { statusCode: 404, body: { error: 'Computador não encontrado.' } };
        }

        const usuarioId = req.session?.user?.id_professor || req.session?.user?.id || null;
        const usuarioNome = req.session?.user?.nome || req.session?.user?.name || null;

        await registrarEquipamentoHistorico(transaction, {
            id_equipamento: computador.id,
            serial_number: computador.SerialNumber || null,
            acao: 'alterar patrimonio',
            nome_antigo: nomeAntigo,
            nome_novo: nomeAntigo,
            patrimonio_antigo: patrimonioAntigo,
            patrimonio_novo: patrimonioNovo,
            usuario_id: usuarioId,
            usuario_nome: usuarioNome
        });

        await transaction.commit();
        return { statusCode: 200, body: { message: 'Patrimônio atualizado com sucesso.' } };
    } catch (error) {
        try {
            await transaction.rollback();
        } catch (_) {
            // no-op
        }
        throw error;
    }
}

async function patchPatrimonioPorId(req, idParam, patrimonio) {
    const id = parseInt(idParam, 10);

    if (!Number.isInteger(id)) {
        return { statusCode: 400, body: { error: 'ID do computador invalido.' } };
    }

    if (patrimonio === undefined || patrimonio === null || !String(patrimonio).trim()) {
        return { statusCode: 400, body: { error: 'patrimonio e obrigatorio.' } };
    }

    const patrimonioNovo = String(patrimonio).trim();
    const pool = await getPool();
    const transaction = new sql.Transaction(pool);

    try {
        await transaction.begin();

        const selectResult = await transaction.request()
            .input('id', sql.Int, id)
            .query('SELECT TOP 1 id, nome_computador, patrimonio, SerialNumber FROM computadores WHERE id = @id');

        if (!selectResult.recordset.length) {
            await transaction.rollback();
            return { statusCode: 404, body: { error: 'Computador nao encontrado.' } };
        }

        const computador = selectResult.recordset[0];
        const patrimonioAntigo = computador.patrimonio || null;
        const nomeAntigo = computador.nome_computador || null;

        const updateResult = await transaction.request()
            .input('id', sql.Int, id)
            .input('patrimonio', sql.NVarChar, patrimonioNovo)
            .query('UPDATE computadores SET patrimonio = @patrimonio WHERE id = @id');

        if (updateResult.rowsAffected[0] === 0) {
            await transaction.rollback();
            return { statusCode: 404, body: { error: 'Computador nao encontrado.' } };
        }

        const usuarioId = req.session?.user?.id_professor || req.session?.user?.id || null;
        const usuarioNome = req.session?.user?.nome || req.session?.user?.name || null;

        await registrarEquipamentoHistorico(transaction, {
            id_equipamento: computador.id,
            serial_number: computador.SerialNumber || null,
            acao: 'alterar patrimonio',
            nome_antigo: nomeAntigo,
            nome_novo: nomeAntigo,
            patrimonio_antigo: patrimonioAntigo,
            patrimonio_novo: patrimonioNovo,
            usuario_id: usuarioId,
            usuario_nome: usuarioNome
        });

        await transaction.commit();
        return { statusCode: 200, body: { message: 'Patrimonio atualizado com sucesso.' } };
    } catch (error) {
        try {
            await transaction.rollback();
        } catch (_) {
            // no-op
        }
        throw error;
    }
}

async function patchDadosManual(req, idParam, body) {
    const id = parseInt(idParam, 10);
    const nomeComputador = isBlank(body?.nome_computador) ? null : String(body.nome_computador).trim();
    const patrimonio = isBlank(body?.patrimonio) ? null : String(body.patrimonio).trim();
    const enderecoMac = isBlank(body?.endereco_mac) ? null : String(body.endereco_mac).trim();
    const cpuInfo = isBlank(body?.cpu_info) ? null : String(body.cpu_info).trim();
    const memoriaRam = isBlank(body?.memoria_ram) ? null : String(body.memoria_ram).trim();
    const discoInfo = isBlank(body?.disco_info) ? null : String(body.disco_info).trim();
    const enderecoIp = isBlank(body?.endereco_ip) ? null : String(body.endereco_ip).trim();
    const serialNormalizado = isBlank(body?.SerialNumber) ? null : normalizeSerialForDb(body.SerialNumber);

    if (!Number.isInteger(id)) {
        return { statusCode: 400, body: { error: 'ID do computador invalido.' } };
    }

    if (!patrimonio) {
        return { statusCode: 400, body: { error: 'patrimonio e obrigatorio.' } };
    }

    if (!isBlank(body?.SerialNumber) && !serialNormalizado) {
        return { statusCode: 400, body: { error: 'Serial informado e invalido.' } };
    }

    const pool = await getPool();
    const transaction = new sql.Transaction(pool);

    try {
        await transaction.begin();

        const computadorResult = await transaction.request()
            .input('id', sql.Int, id)
            .query('SELECT TOP 1 id, cadastro_manual, nome_computador, patrimonio, SerialNumber FROM computadores WHERE id = @id');

        if (!computadorResult.recordset.length) {
            await transaction.rollback();
            return { statusCode: 404, body: { error: 'Computador nao encontrado.' } };
        }

        if (!computadorResult.recordset[0].cadastro_manual) {
            await transaction.rollback();
            return {
                statusCode: 403,
                body: { error: 'Nome e serial so podem ser alterados em computadores cadastrados manualmente.' }
            };
        }

        const computador = computadorResult.recordset[0];
        const nomeAntigo = computador.nome_computador || null;
        const patrimonioAntigo = computador.patrimonio || null;
        const serialAntigo = computador.SerialNumber || null;
        const nomeNovo = nomeComputador !== null ? nomeComputador : nomeAntigo;
        const patrimonioNovo = patrimonio;
        const serialNovo = serialNormalizado !== null ? serialNormalizado : serialAntigo;
        const nomeFoiAlterado = nomeNovo !== nomeAntigo;
        const patrimonioFoiAlterado = patrimonioNovo !== patrimonioAntigo;

        const duplicidadeResult = await transaction.request()
            .input('id', sql.Int, id)
            .input('patrimonio', sql.NVarChar, patrimonio)
            .input('serial', sql.NVarChar, serialNovo || '')
            .query(`
                SELECT TOP 1 id
                FROM computadores
                WHERE id <> @id
                  AND (
                    patrimonio = @patrimonio
                    OR (@serial <> '' AND UPPER(REPLACE(REPLACE(REPLACE(REPLACE(ISNULL(SerialNumber, ''), '/', ''), '\\', ''), '$', ''), ' ', '')) = @serial)
                  )
            `);

        if (duplicidadeResult.recordset.length) {
            await transaction.rollback();
            return { statusCode: 409, body: { error: 'Ja existe computador com este patrimonio ou serial.' } };
        }

        await transaction.request()
            .input('id', sql.Int, id)
            .input('nome_computador', sql.NVarChar, nomeComputador)
            .input('endereco_mac', sql.NVarChar, enderecoMac)
            .input('SerialNumber', sql.NVarChar, serialNormalizado)
            .input('patrimonio', sql.NVarChar, patrimonio)
            .input('cpu_info', sql.NVarChar, cpuInfo)
            .input('memoria_ram', sql.NVarChar, memoriaRam)
            .input('disco_info', sql.NVarChar, discoInfo)
            .input('endereco_ip', sql.NVarChar, enderecoIp)
            .query(`
                UPDATE computadores
                SET nome_computador = @nome_computador,
                    endereco_mac = @endereco_mac,
                    SerialNumber = @SerialNumber,
                    patrimonio = @patrimonio,
                    cpu_info = @cpu_info,
                    memoria_ram = @memoria_ram,
                    disco_info = @disco_info,
                    endereco_ip = @endereco_ip
                WHERE id = @id
            `);

        const usuarioId = req.session?.user?.id_professor || req.session?.user?.id || null;
        const usuarioNome = req.session?.user?.nome || req.session?.user?.name || null;

        if (nomeFoiAlterado || patrimonioFoiAlterado) {
            const acaoParts = [];
            if (nomeFoiAlterado) acaoParts.push('alterar nome');
            if (patrimonioFoiAlterado) acaoParts.push('alterar patrimonio');

            await registrarEquipamentoHistorico(transaction, {
                id_equipamento: computador.id,
                serial_number: serialNovo || serialAntigo,
                acao: acaoParts.join(' e '),
                nome_antigo: nomeAntigo,
                nome_novo: nomeNovo,
                patrimonio_antigo: patrimonioAntigo,
                patrimonio_novo: patrimonioNovo,
                usuario_id: usuarioId,
                usuario_nome: usuarioNome
            });
        }

        await transaction.commit();
        return { statusCode: 200, body: { message: 'Dados do computador manual atualizados com sucesso.' } };
    } catch (error) {
        try {
            await transaction.rollback();
        } catch (_) {
            // no-op
        }
        throw error;
    }
}

async function historicoEquipamentos(req) {
    const tipo = String(req.query.tipo || '').trim();
    const nome = String(req.query.nome || '').trim();
    const patrimonio = String(req.query.patrimonio || '').trim();
    const sala = String(req.query.sala || '').trim();
    const limiteSolicitado = parseInt(req.query.limit, 10);
    const limite = Number.isInteger(limiteSolicitado) && limiteSolicitado > 0 ? Math.min(limiteSolicitado, 500) : 200;

    const pool = await getPool();
    const request = pool.request();
    const conditions = ['1 = 1'];

    if (tipo) {
        request.input('tipo', sql.NVarChar(20), tipo);
        conditions.push('eh.tipo_equipamento = @tipo');
    }

    if (nome) {
        request.input('nome', sql.NVarChar(255), `%${nome}%`);
        conditions.push('(eh.nome_novo LIKE @nome OR eh.nome_antigo LIKE @nome OR eh.serial_number LIKE @nome)');
    }

    if (patrimonio) {
        request.input('patrimonio', sql.NVarChar(100), `%${patrimonio}%`);
        conditions.push('(eh.patrimonio_novo LIKE @patrimonio OR eh.patrimonio_antigo LIKE @patrimonio)');
    }

    if (sala) {
        request.input('sala', sql.NVarChar(255), `%${sala}%`);
        conditions.push('(eh.sala_origem_nome LIKE @sala OR eh.sala_destino_nome LIKE @sala)');
    }

    if (req.session?.user?.permissao !== 'admin') {
        const allowedUnitCodes = getEquipmentUnitCodes(req);
        if (!allowedUnitCodes.length) {
            return [];
        }

        const placeholders = allowedUnitCodes.map((_, index) => `@unit${index}`).join(', ');
        allowedUnitCodes.forEach((code, index) => {
            request.input(`unit${index}`, sql.NVarChar(3), code);
        });

        conditions.push(`(
            COALESCE(origem_academica.codigo_unidade, origem_administrativa.codigo_unidade, '') IN (${placeholders})
            OR COALESCE(destino_academica.codigo_unidade, destino_administrativa.codigo_unidade, '') IN (${placeholders})
        )`);
    }

    const query = `
        SELECT TOP (${limite})
            eh.id,
            eh.tipo_equipamento,
            eh.id_equipamento,
            eh.serial_number,
            eh.acao,
            eh.nome_antigo,
            eh.nome_novo,
            eh.patrimonio_antigo,
            eh.patrimonio_novo,
            eh.sala_origem_id,
            eh.sala_origem_tipo,
            eh.sala_origem_nome,
            eh.sala_destino_id,
            eh.sala_destino_tipo,
            eh.sala_destino_nome,
            COALESCE(origem_academica.codigo_unidade, origem_administrativa.codigo_unidade) AS sala_origem_unidade,
            COALESCE(destino_academica.codigo_unidade, destino_administrativa.codigo_unidade) AS sala_destino_unidade,
            eh.usuario_id,
            eh.usuario_nome,
            eh.data_evento,
            eh.detalhes,
            eh.observacao
        FROM dbo.EquipamentoHistorico eh
        LEFT JOIN Salas origem_academica ON eh.sala_origem_tipo = 'academico' AND origem_academica.id_sala = eh.sala_origem_id
        LEFT JOIN SalasAdministrativas origem_administrativa ON eh.sala_origem_tipo = 'administrativa' AND origem_administrativa.id_sala = eh.sala_origem_id
        LEFT JOIN Salas destino_academica ON eh.sala_destino_tipo = 'academico' AND destino_academica.id_sala = eh.sala_destino_id
        LEFT JOIN SalasAdministrativas destino_administrativa ON eh.sala_destino_tipo = 'administrativa' AND destino_administrativa.id_sala = eh.sala_destino_id
        WHERE ${conditions.join(' AND ')}
        ORDER BY eh.data_evento DESC;
    `;

    const result = await request.query(query);
    return result.recordset || [];
}

module.exports = {
    cadastrarMonitor,
    cadastrarComputadorManual,
    monitorPorPatrimonio,
    editarMonitor,
    excluirMonitor,
    associarComputador,
    computadoresAssociados,
    infoComputadores,
    deduplicarComputadores,
    desassociarComputador,
    listarMonitores,
    monitoresAssociadosAll,
    monitoresAssociados,
    desassociarMonitor,
    associarMonitor,
    inventarioComputadores,
    patchPatrimonioPorSerial,
    patchPatrimonioPorId,
    patchDadosManual,
    historicoEquipamentos,
};
