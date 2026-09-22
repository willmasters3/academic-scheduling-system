const test = require('node:test');
const assert = require('node:assert/strict');
const AgendamentoUtils = require('../public/js/agendamentoUtils');

test('gerarDatasRecorrentes inclui domingo e respeita inicio e fim do intervalo', () => {
  const datas = AgendamentoUtils.gerarDatasRecorrentes({
    dataInicio: '2026-08-02',
    dataFim: '2026-08-09',
    diasSelecionados: [0, 1]
  });

  assert.deepEqual(datas, [
    '2026-08-02',
    '2026-08-03',
    '2026-08-09'
  ]);
});

test('gerarDatasRecorrentes remove dias duplicados sem deslocar fuso horario', () => {
  const datas = AgendamentoUtils.gerarDatasRecorrentes({
    dataInicio: '2026-10-18',
    dataFim: '2026-10-18',
    diasSelecionados: [0, 0, 7]
  });

  assert.deepEqual(datas, ['2026-10-18']);
});
