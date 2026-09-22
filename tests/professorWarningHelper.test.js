const test = require('node:test');
const assert = require('node:assert/strict');
const {
  agruparAvisosProfessorPorData,
  criarTokenAvisosProfessor,
  horariosSobrepostos
} = require('../modules/agendamentos/professorWarningHelper');

test('agruparAvisosProfessorPorData inclui somente sobreposições em datas selecionadas', () => {
  const avisos = agruparAvisosProfessorPorData({
    dataReservas: ['2026-08-10', '2026-08-17', '2026-08-18'],
    reservasProfessorPorData: {
      '2026-08-10': [
        { id_sala: 3, nome_sala: 'Sala 303', hora_inicio: '08:00:00', hora_fim: '12:00:00' },
        { id_sala: 4, nome_sala: 'Laboratório de Mecânica', hora_inicio: '13:00:00', hora_fim: '15:00:00' }
      ],
      '2026-08-17': [
        { id_sala: 5, nome_sala: 'Laboratório de Elétrica', hora_inicio: '10:00:00', hora_fim: '12:00:00' }
      ],
      '2026-08-18': [
        { id_sala: 10, nome_sala: 'Sala 410', hora_inicio: '09:00:00', hora_fim: '11:00:00' }
      ]
    },
    idSalaSolicitada: 10,
    nomeSalaSolicitada: 'Sala 410',
    horaInicio: '08:00:00',
    horaFim: '12:00:00'
  });

  assert.deepEqual(avisos, [
    {
      data: '2026-08-10',
      novaSala: 'Sala 410',
      reservasExistentes: [
        { id_sala: 3, nome_sala: 'Sala 303', hora_inicio: '08:00:00', hora_fim: '12:00:00' }
      ]
    },
    {
      data: '2026-08-17',
      novaSala: 'Sala 410',
      reservasExistentes: [
        { id_sala: 5, nome_sala: 'Laboratório de Elétrica', hora_inicio: '10:00:00', hora_fim: '12:00:00' }
      ]
    }
  ]);
});

test('horariosSobrepostos permite horarios que apenas encostam', () => {
  assert.equal(horariosSobrepostos('08:00:00', '10:00:00', '10:00:00', '12:00:00'), false);
  assert.equal(horariosSobrepostos('08:00:00', '10:01:00', '10:00:00', '12:00:00'), true);
});

test('criarTokenAvisosProfessor gera token estavel e sensivel ao conteudo', () => {
  const avisosA = [
    {
      data: '2026-08-17',
      novaSala: 'Sala 410',
      reservasExistentes: [
        { id_agendamento: 8, id_sala: 5, nome_sala: 'Laboratorio de Eletrica', hora_inicio: '10:00', hora_fim: '12:00' }
      ]
    },
    {
      data: '2026-08-10',
      novaSala: 'Sala 410',
      reservasExistentes: [
        { id_agendamento: 7, id_sala: 3, nome_sala: 'Sala 303', hora_inicio: '08:00:00', hora_fim: '12:00:00' }
      ]
    }
  ];

  const avisosB = [
    {
      data: '2026-08-10',
      novaSala: 'Sala 410',
      reservasExistentes: [
        { id_agendamento: 7, id_sala: 3, nome_sala: 'Sala 303', hora_inicio: '08:00:00', hora_fim: '12:00:00' }
      ]
    },
    {
      data: '2026-08-17',
      novaSala: 'Sala 410',
      reservasExistentes: [
        { id_agendamento: 8, id_sala: 5, nome_sala: 'Laboratorio de Eletrica', hora_inicio: '10:00:00', hora_fim: '12:00:00' }
      ]
    }
  ];

  const tokenA = criarTokenAvisosProfessor(avisosA);
  const tokenB = criarTokenAvisosProfessor(avisosB);
  const tokenAlterado = criarTokenAvisosProfessor([
    {
      data: '2026-08-10',
      novaSala: 'Sala 410',
      reservasExistentes: [
        { id_agendamento: 99, id_sala: 3, nome_sala: 'Sala 303', hora_inicio: '08:00:00', hora_fim: '12:00:00' }
      ]
    }
  ]);

  assert.equal(tokenA, tokenB);
  assert.notEqual(tokenA, tokenAlterado);
  assert.equal(criarTokenAvisosProfessor([]), '');
});
