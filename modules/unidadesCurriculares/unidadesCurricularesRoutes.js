const express = require('express');
const unidadesCurricularesController = require('./unidadesCurricularesController');

const router = express.Router();

router.get('/unidade-curricular/:idUc', unidadesCurricularesController.getUnidadeCurricular);
router.put('/unidade-curricular/:idUc', unidadesCurricularesController.updateUnidadeCurricular);
router.post('/adicionar-unidade-curricular', unidadesCurricularesController.adicionarUnidadeCurricular);
router.get('/listar-ucs-por-unidade/:codigoUnidade', unidadesCurricularesController.listarUcsPorUnidade);
router.post('/associar-unidade-tipo-aula', unidadesCurricularesController.associarUnidadeTipoAula);
router.get('/listar-associacoes/:unidadeId', unidadesCurricularesController.listarAssociacoes);
router.get('/listar-unidades-curriculares', unidadesCurricularesController.listarUnidadesCurriculares);
router.delete('/dessassociar-unidade-tipo-aula', unidadesCurricularesController.dessassociarUnidadeTipoAula);

module.exports = router;
