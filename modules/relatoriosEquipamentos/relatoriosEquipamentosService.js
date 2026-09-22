const sql = require('mssql');
const zlib = require('zlib');
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

function normalizeUnitCode(value) {
    const text = String(value || '').trim().toUpperCase();
    const match = text.match(/(?:^UC)?\s*([0-9]{1,3})/);
    return match ? match[1].padStart(3, '0') : null;
}

function normalizeTipoSala(value) {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized === 'academica' || normalized === 'academico') {
        return 'academico';
    }
    if (normalized === 'administrativa') {
        return 'administrativa';
    }
    return null;
}

function getTipoSalaConfig(tipoSala) {
    const normalized = normalizeTipoSala(tipoSala);
    if (normalized === 'academico') {
        return {
            tipoSala: 'academico',
            tipoSalaLabel: 'Acadêmica',
            tabelaSalas: 'Salas',
            tabelaRelacao: 'SalaComputadorAcademica'
        };
    }
    if (normalized === 'administrativa') {
        return {
            tipoSala: 'administrativa',
            tipoSalaLabel: 'Administrativa',
            tabelaSalas: 'SalasAdministrativas',
            tabelaRelacao: 'SalaComputadorAdministrativa'
        };
    }
    return null;
}

function userCanAccessUnit(req, codigoUnidade) {
    const user = req.session?.user;
    if (!user) {
        return false;
    }
    if (user.permissao === 'admin') {
        return true;
    }

    const requestedCode = normalizeUnitCode(codigoUnidade);
    const allowedCodes = Array.isArray(user.unidades)
        ? user.unidades.map(normalizeUnitCode).filter(Boolean)
        : [];

    return requestedCode && allowedCodes.includes(requestedCode);
}

function sortByName(a, b) {
    return String(a.nome_computador || a.modelo || '').localeCompare(
        String(b.nome_computador || b.modelo || ''),
        'pt-BR',
        { numeric: true, sensitivity: 'base' }
    );
}

function mapComputer(row) {
    return {
        id_computador: row.id_computador,
        nome_computador: row.nome_computador,
        endereco_mac: row.endereco_mac,
        cpu_info: row.cpu_info,
        memoria_ram: row.memoria_ram,
        disco_info: row.disco_info,
        SerialNumber: row.SerialNumber,
        endereco_ip: row.endereco_ip,
        patrimonio: row.patrimonio
    };
}

function mapMonitor(row) {
    return {
        id: row.id,
        modelo: row.modelo,
        polegadas: row.polegadas,
        numero_serie: row.numero_serie,
        patrimonio: row.patrimonio
    };
}

async function listarSalasDisponiveis(req, unidadeId, tipoSalaParam, salaIdParam) {
    const tipoConfig = getTipoSalaConfig(tipoSalaParam);
    if (!tipoConfig) {
        return { statusCode: 400, body: { error: 'Tipo de sala inválido.' } };
    }
    if (!unidadeId) {
        return { statusCode: 400, body: { error: 'Unidade é obrigatória.' } };
    }
    if (!userCanAccessUnit(req, unidadeId)) {
        return { statusCode: 403, body: { error: 'Acesso negado para a unidade informada.' } };
    }

    const salaId = salaIdParam === undefined || salaIdParam === '' ? null : Number(salaIdParam);
    if (salaId !== null && (typeof salaIdParam !== 'string' || !/^\d+$/.test(salaIdParam) || !Number.isSafeInteger(salaId) || salaId <= 0 || salaId > 2147483647)) {
        return { statusCode: 400, body: { error: 'Sala inválida.' } };
    }

    const pool = await getPool();
    const salasResult = await pool.request()
        .input('codigoUnidade', sql.NVarChar, String(unidadeId).trim())
        .input('salaId', sql.Int, salaId)
        .query(`
            SELECT s.id_sala, s.nome_sala, u.nome_unidade, u.codigo_unidade
            FROM ${tipoConfig.tabelaSalas} s
            JOIN Unidades u ON u.codigo_unidade = s.codigo_unidade
            WHERE s.codigo_unidade = @codigoUnidade
              AND (@salaId IS NULL OR s.id_sala = @salaId)
            ORDER BY s.nome_sala
        `);

    if (salaId !== null && !salasResult.recordset.length) {
        return { statusCode: 404, body: { error: 'Sala não encontrada na unidade e no tipo selecionados.' } };
    }
    return { statusCode: 200, body: salasResult.recordset };
}

async function listarSalasEquipamentos(req, unidadeId, tipoSalaParam, salaIdParam) {
    const salasResult = await listarSalasDisponiveis(req, unidadeId, tipoSalaParam, salaIdParam);
    if (salasResult.statusCode !== 200) return salasResult;
    const tipoConfig = getTipoSalaConfig(tipoSalaParam);
    const salas = salasResult.body;
    if (!salas.length) {
        return { statusCode: 200, body: [] };
    }

    const pool = await getPool();
    const salaIds = salas.map((sala) => Number(sala.id_sala)).filter(Number.isInteger);
    const requestComputadores = pool.request();
    const requestMonitores = pool.request();
    const placeholders = salaIds.map((id, index) => {
        requestComputadores.input(`sala${index}`, sql.Int, id);
        requestMonitores.input(`sala${index}`, sql.Int, id);
        return `@sala${index}`;
    }).join(', ');

    const computadoresResult = await requestComputadores.query(`
        SELECT
            sc.id_sala,
            c.id AS id_computador,
            c.nome_computador,
            c.SerialNumber,
            c.endereco_mac,
            c.cpu_info,
            c.memoria_ram,
            c.endereco_ip,
            c.disco_info,
            c.patrimonio
        FROM ${tipoConfig.tabelaRelacao} sc
        JOIN computadores c ON c.id = sc.id_computador
        WHERE sc.id_sala IN (${placeholders})
        ORDER BY sc.id_sala, c.nome_computador
    `);

    const monitoresResult = await requestMonitores.query(`
        SELECT
            ms.id_sala,
            m.id,
            m.modelo,
            m.polegadas,
            m.numero_serie,
            m.patrimonio
        FROM MonitorSala ms
        JOIN monitores m ON m.id = ms.id_monitor
        WHERE ms.id_sala IN (${placeholders})
        ORDER BY ms.id_sala, m.modelo
    `);

    const computadoresPorSala = new Map();
    computadoresResult.recordset.forEach((row) => {
        const idSala = Number(row.id_sala);
        if (!computadoresPorSala.has(idSala)) computadoresPorSala.set(idSala, []);
        const itens = computadoresPorSala.get(idSala);
        if (!itens.some((item) => Number(item.id_computador) === Number(row.id_computador))) {
            itens.push(mapComputer(row));
        }
    });

    const monitoresPorSala = new Map();
    monitoresResult.recordset.forEach((row) => {
        const idSala = Number(row.id_sala);
        if (!monitoresPorSala.has(idSala)) monitoresPorSala.set(idSala, []);
        const itens = monitoresPorSala.get(idSala);
        if (!itens.some((item) => Number(item.id) === Number(row.id))) {
            itens.push(mapMonitor(row));
        }
    });

    const body = salas.map((sala) => {
        const salaId = Number(sala.id_sala);
        const computadores = (computadoresPorSala.get(salaId) || []).sort(sortByName);
        const monitores = (monitoresPorSala.get(salaId) || []).sort(sortByName);

        return {
            unidade: sala.nome_unidade,
            codigoUnidade: sala.codigo_unidade,
            tipoSala: tipoConfig.tipoSalaLabel,
            tipoSalaValor: tipoConfig.tipoSala,
            salaId,
            salaNome: sala.nome_sala,
            computadores,
            monitores,
            totais: {
                computadores: computadores.length,
                monitores: monitores.length,
                total: computadores.length + monitores.length
            }
        };
    });

    return { statusCode: 200, body };
}

function escapeXml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

function sanitizeSheetName(name, fallback, usedNames) {
    let safe = String(name || fallback || 'Sala')
        .replace(/[\[\]\*\/\\\?:]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 31) || 'Sala';

    const base = safe.slice(0, 27);
    let suffix = 1;
    while (usedNames.has(safe.toLowerCase())) {
        safe = `${base} ${suffix}`.slice(0, 31);
        suffix += 1;
    }
    usedNames.add(safe.toLowerCase());
    return safe;
}

function cellRef(columnIndex, rowIndex) {
    let column = '';
    let current = columnIndex;
    while (current > 0) {
        const remainder = (current - 1) % 26;
        column = String.fromCharCode(65 + remainder) + column;
        current = Math.floor((current - 1) / 26);
    }
    return `${column}${rowIndex}`;
}

function xmlCell(value, columnIndex, rowIndex) {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return `<c r="${cellRef(columnIndex, rowIndex)}"><v>${value}</v></c>`;
    }
    return `<c r="${cellRef(columnIndex, rowIndex)}" t="inlineStr"><is><t>${escapeXml(value)}</t></is></c>`;
}

function xmlRow(values, rowIndex) {
    return `<row r="${rowIndex}">${values.map((value, index) => xmlCell(value, index + 1, rowIndex)).join('')}</row>`;
}

function buildWorksheetXml(sala, geradoEm) {
    const rows = [
        ['Unidade', sala.unidade],
        ['Tipo de sala', sala.tipoSala],
        ['Sala', sala.salaNome],
        ['Data/hora', geradoEm],
        [],
        ['Resumo'],
        ['Computadores', sala.totais.computadores],
        ['Monitores', sala.totais.monitores],
        ['Total', sala.totais.total],
        [],
        ['Tipo', 'Nome', 'MAC', 'CPU', 'Memória', 'Disco', 'Serial', 'IP', 'Patrimônio']
    ];

    sala.computadores.forEach((item) => rows.push([
        'Computador',
        item.nome_computador || '',
        item.endereco_mac || '',
        item.cpu_info || '',
        item.memoria_ram || '',
        item.disco_info || '',
        item.SerialNumber || '',
        item.endereco_ip || '',
        item.patrimonio || ''
    ]));

    sala.monitores.forEach((item) => rows.push([
        'Monitor',
        item.modelo || '',
        '',
        '',
        '',
        '',
        item.numero_serie || '',
        '',
        item.patrimonio || ''
    ]));

    const sheetData = rows.map((row, index) => xmlRow(row, index + 1)).join('');
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
    <cols>
        <col min="1" max="9" width="20" customWidth="1"/>
    </cols>
    <sheetData>${sheetData}</sheetData>
</worksheet>`;
}

const crcTable = Array.from({ length: 256 }, (_, index) => {
    let c = index;
    for (let k = 0; k < 8; k += 1) {
        c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    return c >>> 0;
});

function crc32(buffer) {
    let crc = 0xffffffff;
    for (const byte of buffer) {
        crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date = new Date()) {
    const dosTime = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
    const dosDate = ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
    return { dosTime, dosDate };
}

function createZip(files) {
    const chunks = [];
    const central = [];
    let offset = 0;
    const { dosTime, dosDate } = dosDateTime();

    files.forEach((file) => {
        const nameBuffer = Buffer.from(file.name, 'utf8');
        const contentBuffer = Buffer.isBuffer(file.content) ? file.content : Buffer.from(file.content, 'utf8');
        const compressed = zlib.deflateRawSync(contentBuffer);
        const crc = crc32(contentBuffer);

        const localHeader = Buffer.alloc(30);
        localHeader.writeUInt32LE(0x04034b50, 0);
        localHeader.writeUInt16LE(20, 4);
        localHeader.writeUInt16LE(0x0800, 6);
        localHeader.writeUInt16LE(8, 8);
        localHeader.writeUInt16LE(dosTime, 10);
        localHeader.writeUInt16LE(dosDate, 12);
        localHeader.writeUInt32LE(crc, 14);
        localHeader.writeUInt32LE(compressed.length, 18);
        localHeader.writeUInt32LE(contentBuffer.length, 22);
        localHeader.writeUInt16LE(nameBuffer.length, 26);

        chunks.push(localHeader, nameBuffer, compressed);

        const centralHeader = Buffer.alloc(46);
        centralHeader.writeUInt32LE(0x02014b50, 0);
        centralHeader.writeUInt16LE(20, 4);
        centralHeader.writeUInt16LE(20, 6);
        centralHeader.writeUInt16LE(0x0800, 8);
        centralHeader.writeUInt16LE(8, 10);
        centralHeader.writeUInt16LE(dosTime, 12);
        centralHeader.writeUInt16LE(dosDate, 14);
        centralHeader.writeUInt32LE(crc, 16);
        centralHeader.writeUInt32LE(compressed.length, 20);
        centralHeader.writeUInt32LE(contentBuffer.length, 24);
        centralHeader.writeUInt16LE(nameBuffer.length, 28);
        centralHeader.writeUInt32LE(offset, 42);
        central.push(centralHeader, nameBuffer);

        offset += localHeader.length + nameBuffer.length + compressed.length;
    });

    const centralSize = central.reduce((sum, chunk) => sum + chunk.length, 0);
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(files.length, 8);
    end.writeUInt16LE(files.length, 10);
    end.writeUInt32LE(centralSize, 12);
    end.writeUInt32LE(offset, 16);

    return Buffer.concat([...chunks, ...central, end]);
}

function buildWorkbookBuffer(salas, geradoEm) {
    const usedNames = new Set();
    const sheets = salas.length ? salas : [{
        salaNome: 'Equipamentos',
        unidade: '',
        tipoSala: '',
        computadores: [],
        monitores: [],
        totais: { computadores: 0, monitores: 0, total: 0 }
    }];

    const sheetNames = sheets.map((sala, index) => sanitizeSheetName(sala.salaNome, `Sala ${index + 1}`, usedNames));
    const sheetEntries = sheets.map((sala, index) => ({
        name: `xl/worksheets/sheet${index + 1}.xml`,
        content: buildWorksheetXml(sala, geradoEm)
    }));

    const workbookSheets = sheetNames.map((name, index) => (
        `<sheet name="${escapeXml(name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`
    )).join('');

    const workbookRels = sheetNames.map((_, index) => (
        `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`
    )).join('');

    const contentTypesSheets = sheetNames.map((_, index) => (
        `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
    )).join('');

    return createZip([
        {
            name: '[Content_Types].xml',
            content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
    <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
    <Default Extension="xml" ContentType="application/xml"/>
    <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
    ${contentTypesSheets}
</Types>`
        },
        {
            name: '_rels/.rels',
            content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
    <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`
        },
        {
            name: 'xl/workbook.xml',
            content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
    <sheets>${workbookSheets}</sheets>
</workbook>`
        },
        {
            name: 'xl/_rels/workbook.xml.rels',
            content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${workbookRels}</Relationships>`
        },
        ...sheetEntries
    ]);
}

function filenameSafe(value) {
    return String(value || 'relatorio')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9_-]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80)
        .toLowerCase() || 'relatorio';
}

async function gerarExcel(req, unidadeId, tipoSalaParam, salaIdParam) {
    const result = await listarSalasEquipamentos(req, unidadeId, tipoSalaParam, salaIdParam);
    if (result.statusCode !== 200) {
        return result;
    }

    const geradoEm = new Date().toLocaleString('pt-BR');
    const buffer = buildWorkbookBuffer(result.body, geradoEm);
    const tipoLabel = result.body[0]?.tipoSala || normalizeTipoSala(tipoSalaParam) || 'equipamentos';
    const unidadeLabel = result.body[0]?.unidade || unidadeId;

    return {
        statusCode: 200,
        body: buffer,
        filename: `relatorio-equipamentos-${filenameSafe(unidadeLabel)}-${filenameSafe(tipoLabel)}.xlsx`
    };
}

module.exports = {
    listarSalasDisponiveis,
    listarSalasEquipamentos,
    gerarExcel
};
