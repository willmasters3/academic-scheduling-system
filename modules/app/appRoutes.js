const express = require('express');
const router = express.Router();
const sql = require('mssql');
const path = require('path');
const config = require('../../dbConfig');
const professoresRoutes = require('../professores/professoresRoutes');
const tiposAulaRoutes = require('../tiposAula/tiposAulaRoutes');
const unidadesCurricularesRoutes = require('../unidadesCurriculares/unidadesCurricularesRoutes');
const programasRoutes = require('../programas/programasRoutes');
const agendamentosRoutes = require('../agendamentos/agendamentosRoutes');
const salasRoutes = require('../salas/salasRoutes');
const unidadesRoutes = require('../unidades/unidadesRoutes');
const inventarioRoutes = require('../inventario/inventarioRoutes');
const relatoriosRoutes = require('../relatorios/relatoriosRoutes');
const relatoriosEquipamentosRoutes = require('../relatoriosEquipamentos/relatoriosEquipamentosRoutes');
const chatRoutes = require('../chat/chatRoutes');
const agendamentoAuditoriaRoutes = require('../agendamentoAuditoria/agendamentoAuditoriaRoutes');
const alocacoesDocentesRoutes = require('../alocacoesDocentes/alocacoesDocentesRoutes');
const cadastrosAcademicosRoutes = require('../alocacoesDocentes/cadastrosAcademicosRoutes');
const gestaoDocenteRoutes = require('../gestaoDocente/gestaoDocenteRoutes');

let pool;

sql.connect(config)
    .then(p => {
        pool = p;
        console.log('Conectado ao banco de dados');
    })
    .catch(err => console.error('Erro ao conectar ao banco de dados:', err));

router.use(professoresRoutes);
router.use(tiposAulaRoutes);
router.use(unidadesCurricularesRoutes);
router.use(programasRoutes);
router.use(agendamentosRoutes);
router.use(salasRoutes);
router.use(unidadesRoutes);
router.use(inventarioRoutes);
router.use(relatoriosRoutes);
router.use(relatoriosEquipamentosRoutes);
router.use(chatRoutes);
router.use(agendamentoAuditoriaRoutes);
router.use(alocacoesDocentesRoutes);
router.use(cadastrosAcademicosRoutes);
router.use(gestaoDocenteRoutes);

router.get('/registro', (req, res) => {
    res.redirect('/cadastro');
});
// ── AGENDAMENTOS (movido para modules/agendamentos) ──────────────────────────


// ROTAS DE SALAS movidas para modules/salas.
// ROTAS DE UNIDADES movidas para modules/unidades.

// ROTA DE FORM-ADICIONAR-SALAS movida para modules/salas.

// ROTAS DE SALAS movidas para modules/salas.
// ROTAS DE INVENTARIO movidas para modules/inventario.

// ROTAS DE RELATORIOS/DASHBOARD movidas para modules/relatorios.


// ROTAS DE CHAT/IA movidas para modules/chat.

// ROTAS DE CHAT/IA movidas para modules/chat.

// ROTAS DE INVENTARIO movidas para modules/inventario.

// ROTAS DE RELATORIOS movidas para modules/relatorios.

// ROTAS DE SALAS movidas para modules/salas.

// ROTAS DE INVENTARIO movidas para modules/inventario.

module.exports = router;

