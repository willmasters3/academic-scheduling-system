const crypto = require('crypto');

function timeToSeconds(value) {
  const [hours = '0', minutes = '0', seconds = '0'] = String(value || '00:00:00').split(':');
  return (Number(hours) * 3600) + (Number(minutes) * 60) + Number(seconds || 0);
}

function horariosSobrepostos(horaInicioA, horaFimA, horaInicioB, horaFimB) {
  return timeToSeconds(horaInicioA) < timeToSeconds(horaFimB)
    && timeToSeconds(horaFimA) > timeToSeconds(horaInicioB);
}

function agruparAvisosProfessorPorData({
  dataReservas,
  reservasProfessorPorData,
  idSalaSolicitada,
  nomeSalaSolicitada,
  horaInicio,
  horaFim
}) {
  const avisos = [];

  for (const data of dataReservas) {
    const reservas = (reservasProfessorPorData[data] || []).filter((reserva) => {
      if (Number(reserva.id_sala) === Number(idSalaSolicitada)) {
        return false;
      }
      return horariosSobrepostos(horaInicio, horaFim, reserva.hora_inicio, reserva.hora_fim);
    });

    if (reservas.length) {
      avisos.push({
        data,
        novaSala: nomeSalaSolicitada,
        reservasExistentes: reservas.map((reserva) => {
          const reservaNormalizada = {
            id_sala: reserva.id_sala,
            nome_sala: reserva.nome_sala,
            hora_inicio: reserva.hora_inicio,
            hora_fim: reserva.hora_fim
          };

          if (reserva.id_agendamento !== undefined) {
            reservaNormalizada.id_agendamento = reserva.id_agendamento;
          }

          return reservaNormalizada;
        })
      });
    }
  }

  return avisos;
}

function normalizeTimeForToken(value) {
  const text = String(value || '').trim();
  if (/^\d{2}:\d{2}$/.test(text)) return `${text}:00`;
  return text.slice(0, 8);
}

function normalizarAvisosProfessor(avisosProfessor) {
  const avisos = Array.isArray(avisosProfessor) ? avisosProfessor : [];

  return avisos
    .map((aviso) => ({
      data: String(aviso.data || ''),
      novaSala: String(aviso.novaSala || ''),
      reservasExistentes: (Array.isArray(aviso.reservasExistentes) ? aviso.reservasExistentes : [])
        .map((reserva) => ({
          id_agendamento: Number(reserva.id_agendamento) || 0,
          id_sala: Number(reserva.id_sala) || 0,
          nome_sala: String(reserva.nome_sala || ''),
          hora_inicio: normalizeTimeForToken(reserva.hora_inicio),
          hora_fim: normalizeTimeForToken(reserva.hora_fim)
        }))
        .sort((a, b) => (
          a.id_agendamento - b.id_agendamento
          || a.id_sala - b.id_sala
          || a.hora_inicio.localeCompare(b.hora_inicio)
          || a.hora_fim.localeCompare(b.hora_fim)
          || a.nome_sala.localeCompare(b.nome_sala)
        ))
    }))
    .filter((aviso) => aviso.data && aviso.reservasExistentes.length)
    .sort((a, b) => (
      a.data.localeCompare(b.data)
      || a.novaSala.localeCompare(b.novaSala)
    ));
}

function criarTokenAvisosProfessor(avisosProfessor) {
  const avisosNormalizados = normalizarAvisosProfessor(avisosProfessor);
  if (!avisosNormalizados.length) {
    return '';
  }

  return crypto
    .createHash('sha256')
    .update(JSON.stringify(avisosNormalizados))
    .digest('hex');
}

module.exports = {
  agruparAvisosProfessorPorData,
  criarTokenAvisosProfessor,
  horariosSobrepostos,
  normalizarAvisosProfessor
};
