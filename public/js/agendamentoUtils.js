(function (root, factory) {
    const api = factory();
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
    root.AgendamentoUtils = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    function getLuxon() {
        if (typeof require === 'function' && typeof module !== 'undefined' && module.exports) {
            try {
                return require('luxon');
            } catch (error) {
                return null;
            }
        }
        return typeof luxon !== 'undefined' ? luxon : null;
    }

    function normalizarDiasSelecionados(diasSelecionados) {
        const valores = Array.isArray(diasSelecionados) ? diasSelecionados : [];
        const diasNorm = valores
            .map((valor) => Number(valor))
            .filter((valor) => Number.isInteger(valor) && valor >= 0 && valor <= 6)
            .map((valor) => (valor === 0 ? 7 : valor));

        return Array.from(new Set(diasNorm)).sort((a, b) => a - b);
    }

    function gerarDatasRecorrentes({ dataInicio, dataFim, diasSelecionados }) {
        const Luxon = getLuxon();
        if (!Luxon || !dataInicio || !dataFim) {
            return [];
        }

        const DateTime = Luxon.DateTime;
        const inicio = DateTime.fromISO(dataInicio, { zone: 'UTC' }).startOf('day');
        const fim = DateTime.fromISO(dataFim, { zone: 'UTC' }).startOf('day');

        if (!inicio.isValid || !fim.isValid || inicio > fim) {
            return [];
        }

        const diasNorm = normalizarDiasSelecionados(diasSelecionados);
        const datas = [];
        const visitadas = new Set();
        let cursor = inicio;

        while (cursor <= fim) {
            if (diasNorm.includes(cursor.weekday)) {
                const dataISO = cursor.toISODate();
                if (!visitadas.has(dataISO)) {
                    visitadas.add(dataISO);
                    datas.push(dataISO);
                }
            }
            cursor = cursor.plus({ days: 1 });
        }

        return datas;
    }

    function converterDataBrParaIso(dataBr) {
        if (!dataBr) return '';
        const partes = String(dataBr).trim().split('/');
        if (partes.length !== 3) return '';
        const [dia, mes, ano] = partes.map((valor) => Number(valor));
        if (!Number.isInteger(dia) || !Number.isInteger(mes) || !Number.isInteger(ano)) {
            return '';
        }
        return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
    }

    function formatarDataIsoParaBr(dataIso) {
        if (!dataIso) return '';
        const partes = String(dataIso).split('-');
        if (partes.length !== 3) return dataIso;
        return `${partes[2]}/${partes[1]}/${partes[0]}`;
    }

    return {
        normalizarDiasSelecionados,
        gerarDatasRecorrentes,
        converterDataBrParaIso,
        formatarDataIsoParaBr
    };
});
