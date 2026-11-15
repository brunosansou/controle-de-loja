# Controle de Loja — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** App web instalável (PWA) para Android que registra entradas e saídas da loja, fecha o dia com féria, despesa e divisão Arnaldo 70% / Gilmar 30%, leva o prejuízo para o próximo dia com movimento, guarda o histórico e faz backup por arquivo.

**Architecture:** Site estático sem etapa de build: HTML, CSS e JavaScript puro em módulos ES. As regras de negócio ficam em módulos puros testáveis em Node: `money`, `dates`, `calc`, `store` e `backup`. O `store` fala com um "backend" de armazenamento injetado: IndexedDB no navegador e memória nos testes. As telas são funções que desenham dentro de `#app`, com um roteador por hash. O service worker faz o cache do app para funcionar offline.

**Tech Stack:** HTML/CSS/JS (ES2022, módulos nativos), IndexedDB, Service Worker, Web App Manifest. Testes com `node:test` (Node.js LTS, só no desenvolvimento, sem dependências npm). Servidor local: `python -m http.server`.

**Spec:** [docs/superpowers/specs/2026-11-15-controle-de-loja-design.md](../specs/2026-11-15-controle-de-loja-design.md)

## Global Constraints

- Interface toda em português do Brasil. Formato de valor: `R$ 1.234,56`, com espaço comum depois de "R$".
- Valores sempre em **inteiros de centavos**, sem ponto flutuante para dinheiro.
- Divisão: Arnaldo = `Math.round(saldo * 7 / 10)`. Gilmar = `saldo − Arnaldo`. Só quando o saldo for maior que zero. Caso contrário, os dois recebem 0.
- Dinheiro/Pix só nas entradas. Nas saídas, `method` é sempre `null`.
- Datas como chave `YYYY-MM-DD` no **fuso local** do aparelho. Nunca usar `toISOString()` nem `new Date('YYYY-MM-DD')` para obter ou interpretar o dia.
- Totais, saldo, divisão e prejuízo **nunca são gravados**: são sempre calculados a partir dos lançamentos.
- Ficam gravados só: lançamentos (`entries`), estado de cada dia (`days`) e metadados (`meta`: `lastBackupAt`).
- Nenhuma dependência em produção. Nenhum caminho absoluto (`/js/...`): tudo relativo (`./js/...`), porque o GitHub Pages serve o app em subpasta.
- Botões com pelo menos 48px de altura. Deve funcionar com uma mão, em tela de celular a partir de 360px de largura.
- Funciona sem internet depois da primeira visita.
- Texto de usuário (descrição) sempre inserido no HTML com escape (`textContent` ou função `escapeHtml`).

## Review Focus

1. **Depois das 21h no Brasil (UTC−3)**, um lançamento tem que cair no dia de hoje, não no de amanhã. Isso é coberto por teste em `dates` (Task 1).
2. **Um arquivo de backup errado ou corrompido** não pode apagar os dados atuais. A importação valida tudo antes de substituir. Coberto por testes em `backup` e `store` (Tasks 3 e 4).
3. **Valor digitado em formatos variados** ("R$ 1.234,56", "10.5", "1.234", "10,") deve ser entendido. Zero, negativo, vazio e texto são recusados. Coberto por testes em `money` (Task 1).
4. **Lançar, editar ou excluir num dia fechado** é recusado até reabrir o dia. Lançar em data futura é recusado. Coberto por testes em `store` (Task 3).
5. **App aberto que vira a meia-noite e toque duplo em "Salvar"**: a tela Hoje recalcula a data ao voltar ao app (`visibilitychange`) e o botão Salvar fica desativado enquanto grava. Verificação manual na Task 5.

---

## Estrutura de arquivos

```
index.html               casca do app, <div id="app">, abas, registro do SW
manifest.webmanifest     manifesto PWA
sw.js                    service worker (cache do app)
css/app.css              estilos
icons/icon-192.png       ícones (gerados)
icons/icon-512.png
js/money.js              parseBRL, formatBRL
js/dates.js              todayKey, formatShort, formatLong, isFuture
js/calc.js               computeLedger, splitSaldo, pendingLossForToday, unclosedPastDays
js/store.js              createStore(backend) — regras de gravação
js/backup.js             buildBackup, parseBackup, backupFileName, needsBackupReminder
js/idb-backend.js        backend IndexedDB
js/app.js                inicialização, roteador por hash
js/ui/dom.js             escapeHtml, helpers de render
js/ui/day-view.js        tela de um dia (Hoje e detalhe do histórico)
js/ui/entry-form.js      formulário de lançamento (novo/editar)
js/ui/closing-view.js    tela de fechamento
js/ui/history-view.js    lista de dias
js/ui/backup-view.js     exportar/importar
scripts/make_icons.py    gera os PNGs só com a biblioteca padrão do Python
tests/memory-backend.js  backend em memória para testes
tests/*.test.js
package.json             {"type":"module","scripts":{"test":"node --test \"tests/*.test.js\""}}
.gitignore
```

## Modelo de dados (compartilhado por todas as tasks)

```js
// Entry (store "entries", keyPath "id")
{ id: string,            // crypto.randomUUID()
  date: 'YYYY-MM-DD',
  type: 'entrada' | 'saida',
  amountCents: number,   // inteiro > 0
  description: string,   // '' se vazio, com trim
  method: 'dinheiro' | 'pix' | null,  // null em saída
  createdAt: string,     // ISO
  updatedAt: string }    // ISO

// DayState (store "days", keyPath "date")
{ date: 'YYYY-MM-DD', closed: boolean, closedAt: string | null }

// Meta (store "meta", keyPath "key")
{ key: 'lastBackupAt', value: string | null }
```

---

### Task 1: Preparação, dinheiro e datas

**Files:**
- Create: `package.json`, `.gitignore`, `js/money.js`, `js/dates.js`
- Test: `tests/money.test.js`, `tests/dates.test.js`

**Interfaces:**
- Produces:
  - `parseBRL(text: string): number | null`: centavos, ou `null` se inválido ou ≤ 0.
  - `formatBRL(cents: number): string`: `"R$ 1.234,56"`. Negativo: `"-R$ 300,00"`.
  - `todayKey(now?: Date): string`: `'YYYY-MM-DD'` local.
  - `parseKey(key: string): Date`: meia-noite local (`new Date(y, m-1, d)`).
  - `formatShort(key): string`: `'14/11'`.
  - `formatLong(key): string`: `'dom 15/11'` (dias: dom seg ter qua qui sex sáb).
  - `isFuture(key, now?: Date): boolean`.

- [ ] **Step 1: Instalar o Node.js LTS (só para os testes) e iniciar o git**

Confirme com o usuário antes de instalar. Rode `winget install OpenJS.NodeJS.LTS`, abra um novo terminal e rode `node --version`. Esperado: `v22` ou superior. Depois rode `git init`. Crie o `package.json` (conteúdo na estrutura acima) e o `.gitignore` com `node_modules/`.

- [ ] **Step 2: Escrever os testes que falham**

`tests/money.test.js`:
```js
test('parseBRL aceita formatos comuns', () => {
  assert.equal(parseBRL('10'), 1000);
  assert.equal(parseBRL('10,5'), 1050);
  assert.equal(parseBRL('10,50'), 1050);
  assert.equal(parseBRL('10,'), 1000);
  assert.equal(parseBRL('1.234,56'), 123456);
  assert.equal(parseBRL('1234.56'), 123456);
  assert.equal(parseBRL('10.5'), 1050);
  assert.equal(parseBRL('1.234'), 123400);      // ponto + 3 dígitos = milhar
  assert.equal(parseBRL('R$ 1.234,56'), 123456);
  assert.equal(parseBRL(' 80 '), 8000);
});
test('parseBRL recusa inválidos', () => {
  for (const t of ['', '0', '0,00', '-5', 'abc', '10,555', '1,2,3']) assert.equal(parseBRL(t), null, t);
});
test('formatBRL', () => {
  assert.equal(formatBRL(123456), 'R$ 1.234,56');
  assert.equal(formatBRL(5), 'R$ 0,05');
  assert.equal(formatBRL(0), 'R$ 0,00');
  assert.equal(formatBRL(100000000), 'R$ 1.000.000,00');
  assert.equal(formatBRL(-30000), '-R$ 300,00');
});
```

`tests/dates.test.js`:
```js
test('todayKey usa fuso local, não UTC', () => {
  assert.equal(todayKey(new Date(2026, 10, 15, 22, 30)), '2026-11-15');
  assert.equal(todayKey(new Date(2026, 0, 5, 0, 1)), '2026-01-05');
});
test('formatShort / formatLong', () => {
  assert.equal(formatShort('2026-11-14'), '14/11');
  assert.equal(formatLong('2026-11-15'), 'dom 15/11');
  assert.equal(formatLong('2026-11-14'), 'sáb 14/11');
});
test('isFuture', () => {
  const now = new Date(2026, 10, 15, 23, 59);
  assert.equal(isFuture('2026-11-16', now), true);
  assert.equal(isFuture('2026-11-15', now), false);
  assert.equal(isFuture('2026-11-01', now), false);
});
```
Rode os testes com `TZ=America/Sao_Paulo`, definido em `process.env.TZ` no topo do arquivo de testes de datas, antes de qualquer `Date`, para o teste do fuso fazer sentido em qualquer máquina.

- [ ] **Step 3: Rodar e ver falhar**

Run: `npm test`
Expected: FAIL (módulos não existem)

- [ ] **Step 4: Implementar `js/money.js` e `js/dates.js`**

Regra do `parseBRL`: remova "R$" e os espaços. Se houver vírgula, ela é o separador decimal e os pontos são de milhar. Se não houver vírgula e houver só um ponto seguido de 1 ou 2 dígitos no final, esse ponto é decimal. Em qualquer outro caso, o ponto é de milhar. Mais de 2 casas decimais, ou mais de uma vírgula, torna o valor inválido. Converta para centavos com inteiros, sem `parseFloat`. O `formatBRL` deve ser feito à mão, sem `Intl`, que usa espaço não-separável.

- [ ] **Step 5: Rodar e ver passar**

Run: `npm test`
Expected: PASS, todos

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: utilitários de dinheiro e datas"
```

---

### Task 2: Cálculos do dia, divisão e prejuízo levado adiante

**Files:**
- Create: `js/calc.js`
- Test: `tests/calc.test.js`

**Interfaces:**
- Consumes: modelo `Entry` e `DayState`.
- Produces:
  - `splitSaldo(saldoCents: number): { arnaldoCents, gilmarCents }`
  - `computeLedger(entries: Entry[], dayStates: Record<string, DayState>): Ledger`
  ```js
  Ledger = { days: DaySummary[],   // só datas com ≥1 lançamento, em ordem crescente
             carryOut: { fromDate, cents } | null }  // prejuízo do último dia ainda não absorvido
  DaySummary = { date, entries,    // lançamentos do dia, createdAt decrescente
    dinheiroCents, pixCents, feriaCents, saidasCents,
    prejuizoAnterior: { fromDate, cents } | null,
    despesaCents,                  // saidasCents + prejuizoAnterior.cents
    saldoCents, arnaldoCents, gilmarCents, closed }   // closed = dayStates[date]?.closed === true
  ```
  - `findDay(ledger, date): DaySummary | null`
  - `pendingLossForToday(ledger, today): { fromDate, cents } | null`: o `carryOut`, se hoje não tem lançamentos e `carryOut.fromDate < today`.
  - `unclosedPastDays(ledger, today): string[]`: datas antes de hoje com lançamentos e não fechadas.

- [ ] **Step 1: Escrever os testes que falham**

Use um helper `e(date, type, cents, method)` que monta um `Entry` com `id` e `createdAt` únicos.

```js
test('splitSaldo', () => {
  assert.deepEqual(splitSaldo(150000), { arnaldoCents: 105000, gilmarCents: 45000 });
  assert.deepEqual(splitSaldo(1),      { arnaldoCents: 1, gilmarCents: 0 });
  assert.deepEqual(splitSaldo(5),      { arnaldoCents: 4, gilmarCents: 1 });
  assert.deepEqual(splitSaldo(0),      { arnaldoCents: 0, gilmarCents: 0 });
  assert.deepEqual(splitSaldo(-300),   { arnaldoCents: 0, gilmarCents: 0 });
});
test('exemplo da spec: féria 2.000, despesa 500', () => {
  const L = computeLedger([e('2026-11-15','entrada',120000,'dinheiro'), e('2026-11-15','entrada',80000,'pix'), e('2026-11-15','saida',50000)], {});
  const d = L.days[0];
  assert.equal(d.dinheiroCents, 120000); assert.equal(d.pixCents, 80000);
  assert.equal(d.feriaCents, 200000); assert.equal(d.despesaCents, 50000);
  assert.equal(d.saldoCents, 150000); assert.equal(d.arnaldoCents, 105000); assert.equal(d.gilmarCents, 45000);
  assert.equal(L.carryOut, null);
});
test('prejuízo pula dia sem movimento e vira despesa no próximo dia com lançamento', () => {
  const L = computeLedger([
    e('2026-11-14','entrada',10000,'dinheiro'), e('2026-11-14','saida',40000),
    e('2026-11-16','entrada',100000,'pix'),     e('2026-11-16','saida',10000)], {});
  assert.equal(L.days.length, 2);
  assert.equal(L.days[0].saldoCents, -30000); assert.equal(L.days[0].arnaldoCents, 0);
  assert.deepEqual(L.days[1].prejuizoAnterior, { fromDate: '2026-11-14', cents: 30000 });
  assert.equal(L.days[1].despesaCents, 40000);
  assert.equal(L.days[1].saldoCents, 60000); assert.equal(L.days[1].arnaldoCents, 42000); assert.equal(L.days[1].gilmarCents, 18000);
});
test('prejuízo acumula em sequência', () => {
  const L = computeLedger([e('2026-11-14','saida',30000), e('2026-11-15','entrada',10000,'dinheiro'), e('2026-11-16','entrada',50000,'dinheiro')], {});
  assert.equal(L.days[1].saldoCents, -20000);
  assert.deepEqual(L.days[2].prejuizoAnterior, { fromDate: '2026-11-15', cents: 20000 });
  assert.equal(L.days[2].saldoCents, 30000);
});
test('saldo zero não leva nada adiante', () => {
  const L = computeLedger([e('2026-11-14','entrada',100,'pix'), e('2026-11-14','saida',100)], {});
  assert.equal(L.carryOut, null);
});
test('correção num dia anterior muda o dia seguinte', () => {
  const base = [e('2026-11-14','saida',30000), e('2026-11-15','entrada',50000,'pix')];
  assert.equal(computeLedger(base, {}).days[1].saldoCents, 20000);
  const corrigido = [{ ...base[0], amountCents: 10000 }, base[1]];
  assert.equal(computeLedger(corrigido, {}).days[1].saldoCents, 40000);
});
test('pendingLossForToday e unclosedPastDays', () => {
  const L = computeLedger([e('2026-11-14','saida',30000)], {});
  assert.deepEqual(pendingLossForToday(L, '2026-11-15'), { fromDate: '2026-11-14', cents: 30000 });
  assert.equal(pendingLossForToday(L, '2026-11-14'), null);
  assert.deepEqual(unclosedPastDays(L, '2026-11-15'), ['2026-11-14']);
  const L2 = computeLedger([e('2026-11-14','saida',30000)], { '2026-11-14': { date: '2026-11-14', closed: true, closedAt: 'x' } });
  assert.deepEqual(unclosedPastDays(L2, '2026-11-15'), []);
  assert.equal(L2.days[0].closed, true);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test`
Expected: FAIL em `tests/calc.test.js`

- [ ] **Step 3: Implementar `js/calc.js`**

Agrupe os lançamentos por data e percorra as datas em ordem crescente, levando `carry`. Em cada dia: `prejuizoAnterior = carry`, `despesa = saídas + (carry?.cents ?? 0)`, `saldo = féria − despesa`. Depois do dia, `carry = saldo < 0 ? { fromDate: date, cents: -saldo } : null`. Ao final, `carryOut = carry`.

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: cálculo do dia, divisão 70/30 e prejuízo levado adiante"
```

---

### Task 3: Store (regras de gravação) com backend em memória

**Files:**
- Create: `js/store.js`, `tests/memory-backend.js`
- Test: `tests/store.test.js`

**Interfaces:**
- Consumes: `parseKey`/`isFuture` de `dates.js`.
- Produces:
  - Contrato de backend (implementado por `tests/memory-backend.js` agora e por `js/idb-backend.js` na Task 5):
    ```js
    { getAll(store: 'entries'|'days'|'meta'): Promise<object[]>,
      put(store, obj): Promise<void>,
      delete(store, key): Promise<void>,
      replaceAll({ entries, days, meta }): Promise<void> }  // atômico: tudo ou nada
    ```
  - `createMemoryBackend(): Backend` (só nos testes).
  - `class StoreError extends Error { code }`, com códigos: `'VALOR_INVALIDO'`, `'FORMA_INVALIDA'`, `'TIPO_INVALIDO'`, `'DATA_FUTURA'`, `'DIA_FECHADO'`, `'NAO_ENCONTRADO'`.
  - `createStore(backend, { now = () => new Date(), newId = () => crypto.randomUUID() } = {})` retorna:
    - `listEntries(): Promise<Entry[]>`
    - `getDayStates(): Promise<Record<string, DayState>>`
    - `addEntry({ date, type, amountCents, description, method }): Promise<Entry>`
    - `updateEntry(id, { amountCents?, description?, method? }): Promise<Entry>`: não muda `type` nem `date`.
    - `deleteEntry(id): Promise<void>`
    - `closeDay(date): Promise<void>` / `reopenDay(date): Promise<void>`
    - `getLastBackupAt(): Promise<string|null>` / `setLastBackupAt(iso): Promise<void>`
    - `replaceAll({ entries, days, lastBackupAt }): Promise<void>`

- [ ] **Step 1: Escrever os testes que falham**

Com `now = () => new Date(2026, 10, 15, 14, 0)` e `newId` sequencial:
```js
test('addEntry grava entrada com forma e saída sem forma', async () => {
  const s = createStore(createMemoryBackend(), opts);
  const a = await s.addEntry({ date: '2026-11-15', type: 'entrada', amountCents: 8000, description: '  venda  ', method: 'pix' });
  assert.equal(a.description, 'venda'); assert.equal(a.method, 'pix'); assert.ok(a.createdAt && a.updatedAt);
  const b = await s.addEntry({ date: '2026-11-15', type: 'saida', amountCents: 500, description: '', method: 'pix' });
  assert.equal(b.method, null);
  assert.equal((await s.listEntries()).length, 2);
});
test('recusas', async () => {
  const s = createStore(createMemoryBackend(), opts);
  const base = { date: '2026-11-15', type: 'entrada', amountCents: 100, description: '', method: 'dinheiro' };
  await rejectsCode(s.addEntry({ ...base, amountCents: 0 }), 'VALOR_INVALIDO');
  await rejectsCode(s.addEntry({ ...base, amountCents: 10.5 }), 'VALOR_INVALIDO');
  await rejectsCode(s.addEntry({ ...base, method: null }), 'FORMA_INVALIDA');
  await rejectsCode(s.addEntry({ ...base, type: 'outro' }), 'TIPO_INVALIDO');
  await rejectsCode(s.addEntry({ ...base, date: '2026-11-16' }), 'DATA_FUTURA');
  await rejectsCode(s.updateEntry('nao-existe', { amountCents: 5 }), 'NAO_ENCONTRADO');
});
test('dia fechado bloqueia lançar/editar/excluir até reabrir', async () => {
  const s = createStore(createMemoryBackend(), opts);
  const a = await s.addEntry({ date: '2026-11-15', type: 'saida', amountCents: 100, description: '', method: null });
  await s.closeDay('2026-11-15');
  assert.equal((await s.getDayStates())['2026-11-15'].closed, true);
  await rejectsCode(s.addEntry({ date: '2026-11-15', type: 'saida', amountCents: 1, description: '', method: null }), 'DIA_FECHADO');
  await rejectsCode(s.updateEntry(a.id, { amountCents: 200 }), 'DIA_FECHADO');
  await rejectsCode(s.deleteEntry(a.id), 'DIA_FECHADO');
  await s.reopenDay('2026-11-15');
  const u = await s.updateEntry(a.id, { amountCents: 200 });
  assert.equal(u.amountCents, 200);
});
test('replaceAll substitui tudo e grava lastBackupAt', async () => {
  const s = createStore(createMemoryBackend(), opts);
  await s.addEntry({ date: '2026-11-15', type: 'saida', amountCents: 100, description: '', method: null });
  await s.replaceAll({ entries: [], days: [], lastBackupAt: '2026-11-10T10:00:00.000Z' });
  assert.equal((await s.listEntries()).length, 0);
  assert.equal(await s.getLastBackupAt(), '2026-11-10T10:00:00.000Z');
});
```
`rejectsCode(promise, code)` é um helper local: `assert.rejects(promise, err => err.code === code)`.

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test`
Expected: FAIL em `tests/store.test.js`

- [ ] **Step 3: Implementar `tests/memory-backend.js` e `js/store.js`**

O backend em memória usa um `Map` por store, com chaves `id`, `date` e `key`. A validação de `updateEntry` reaproveita a mesma da criação, aplicada ao lançamento já mesclado com as mudanças.

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: store com regras de dia fechado e validações"
```

---

### Task 4: Backup (formato, validação e lembrete)

**Files:**
- Create: `js/backup.js`
- Test: `tests/backup.test.js`

**Interfaces:**
- Consumes: `todayKey` de `dates.js`.
- Produces:
  - `buildBackup({ entries, days }, now: Date): BackupData`, com `{ app: 'controle-de-loja', version: 1, exportedAt: ISO, entries, days }`.
  - `backupFileName(now: Date): string`, que gera `'controle-loja-backup-2026-11-15.json'` (data local).
  - `class BackupError extends Error`, com código `'ARQUIVO_INVALIDO'`.
  - `parseBackup(text: string): BackupData`, que lança `BackupError` se o JSON for inválido, `app` for diferente, `version !== 1`, `entries` ou `days` não forem arrays, ou se algum lançamento tiver `id` vazio, `date` fora de `^\d{4}-\d{2}-\d{2}$`, `type` inválido, `amountCents` que não seja inteiro positivo, ou `method` incoerente com o tipo.
  - `needsBackupReminder({ now: Date, lastBackupAt: string|null, entries: Entry[] }): boolean`. A regra é esta: sem lançamentos, `false`. A referência é `lastBackupAt` ou, se nunca houve backup, o `createdAt` mais antigo. É `true` se algum `updatedAt` for maior que `lastBackupAt` (ou se nunca houve backup) **e** se tiverem passado 7 dias ou mais desde a referência.

- [ ] **Step 1: Escrever os testes que falham**

Fixtures no topo do arquivo: `entrada` é um `Entry` válido (`type: 'entrada'`, `method: 'dinheiro'`, `amountCents: 8000`). `diaFechado = { date: '2026-11-15', closed: true, closedAt: '2026-11-15T21:00:00.000Z' }`.

```js
test('ida e volta', () => {
  const data = buildBackup({ entries: [entrada], days: [diaFechado] }, new Date(2026, 10, 15, 22, 0));
  const back = parseBackup(JSON.stringify(data));
  assert.deepEqual(back.entries, [entrada]); assert.deepEqual(back.days, [diaFechado]);
  assert.equal(backupFileName(new Date(2026, 10, 15, 22, 0)), 'controle-loja-backup-2026-11-15.json');
});
test('recusa arquivos inválidos', () => {
  const ok = buildBackup({ entries: [entrada], days: [] }, new Date());
  for (const bad of ['', 'não é json', '{}', JSON.stringify({ ...ok, app: 'outro' }), JSON.stringify({ ...ok, version: 2 }),
                     JSON.stringify({ ...ok, entries: [{ ...entrada, amountCents: -1 }] }),
                     JSON.stringify({ ...ok, entries: [{ ...entrada, type: 'saida', method: 'pix' }] })])
    assert.throws(() => parseBackup(bad), BackupError);
});
test('lembrete de backup', () => {
  const now = new Date('2026-11-15T12:00:00Z');
  const old = { ...entrada, createdAt: '2026-11-01T12:00:00Z', updatedAt: '2026-11-01T12:00:00Z' };
  assert.equal(needsBackupReminder({ now, lastBackupAt: null, entries: [] }), false);
  assert.equal(needsBackupReminder({ now, lastBackupAt: null, entries: [old] }), true);
  assert.equal(needsBackupReminder({ now, lastBackupAt: null, entries: [{ ...old, createdAt: '2026-11-14T12:00:00Z' }] }), false);
  assert.equal(needsBackupReminder({ now, lastBackupAt: '2026-11-05T12:00:00Z', entries: [old] }), false); // nada novo
  assert.equal(needsBackupReminder({ now, lastBackupAt: '2026-11-05T12:00:00Z', entries: [old, { ...old, id: 'n', updatedAt: '2026-11-06T12:00:00Z' }] }), true);
  assert.equal(needsBackupReminder({ now, lastBackupAt: '2026-11-10T12:00:00Z', entries: [{ ...old, updatedAt: '2026-11-11T12:00:00Z' }] }), false); // só 5 dias
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test`
Expected: FAIL em `tests/backup.test.js`

- [ ] **Step 3: Implementar `js/backup.js`**

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: formato de backup, validação e lembrete"
```

---

### Task 5: IndexedDB, casca do app, tela Hoje e lançamento

**Files:**
- Create: `index.html`, `css/app.css`, `js/idb-backend.js`, `js/app.js`, `js/ui/dom.js`, `js/ui/day-view.js`, `js/ui/entry-form.js`

**Interfaces:**
- Consumes: `createStore`, `computeLedger`, `findDay`, `pendingLossForToday`, `unclosedPastDays`, `formatBRL`, `parseBRL`, `todayKey`, `formatLong`, `formatShort`.
- Produces:
  - `openIdbBackend(): Promise<Backend>`: banco `'controle-loja'`, versão 1, stores `entries` (keyPath `id`), `days` (keyPath `date`) e `meta` (keyPath `key`). O `replaceAll` faz clear + put em uma única transação nos três stores.
  - `escapeHtml(s: string): string`.
  - Rotas (hash): `#/hoje`, `#/dia/YYYY-MM-DD`, `#/lancar/entrada/YYYY-MM-DD`, `#/lancar/saida/YYYY-MM-DD`, `#/editar/<id>`, `#/fechar/YYYY-MM-DD`, `#/historico`, `#/backup`. Rota vazia ou desconhecida vai para `#/hoje`.
  - `renderDayView(root, ctx, date)` e `renderEntryForm(root, ctx, { mode: 'novo'|'editar', type, date, entry? })`, onde `ctx = { store, refresh(): Promise<{entries, dayStates, ledger}>, navigate(hash), now() }`.

- [ ] **Step 1: Montar a casca**

`index.html` com `<meta name="viewport" content="width=device-width, initial-scale=1">`, `lang="pt-BR"`, `<div id="app">`, barra inferior fixa com abas **Hoje | Histórico | Backup** e `<script type="module" src="./js/app.js">`. O `app.js` abre o backend, cria o store, escuta `hashchange` e chama a tela da rota. Também escuta `visibilitychange` para redesenhar a rota atual quando o app volta à tela, o que recalcula a data de hoje.

- [ ] **Step 2: Tela do dia (`day-view.js`)**

Topo com "Hoje — dom 15/11" (ou só a data, se não for hoje), mais Féria, Despesa e Saldo do dia. Use `findDay`. Sem lançamentos, mostre zeros. Botões grandes **+ Entrada** e **− Saída**. A lista mostra hora (HH:MM, de `createdAt`), descrição (ou "Entrada"/"Saída" se vazia), "Dinheiro"/"Pix" nas entradas e o valor com sinal. Se `prejuizoAnterior` existir, ele aparece no topo da lista como linha fixa, não editável: "Prejuízo de DD/MM". Tocar num lançamento abre `#/editar/<id>`. Botão **Fechar dia** vai para `#/fechar/<date>`.

Avisos no topo da tela Hoje:
- `pendingLossForToday`: "Prejuízo de 14/11 (R$ 300,00) entra como despesa no primeiro lançamento de hoje."
- `unclosedPastDays`: "O dia 14/11 não foi fechado. [Fechar]".

Num dia fechado: selo "Fechado", sem os botões de lançar e com o botão **Reabrir dia**. Ao reabrir, peça confirmação com `confirm("Corrigir este dia pode alterar os dias seguintes. Reabrir?")`.

- [ ] **Step 3: Formulário (`entry-form.js`)**

Campo de valor com `inputmode="decimal"` e foco automático, campo de descrição e, só em entrada, botões de alternância **Dinheiro** (já selecionado) / **Pix**. Salvar usa `parseBRL`. Se o valor for inválido, mostre "Digite um valor maior que zero" e não grave. Desative o botão Salvar enquanto grava, para o toque duplo não gerar um lançamento repetido. Mostre o `StoreError` com mensagem em português (ex.: `DIA_FECHADO` → "Este dia está fechado. Reabra para alterar."). No modo editar, há o botão **Excluir**, com `confirm`. Depois de salvar ou excluir, volte para a tela do dia do lançamento.

- [ ] **Step 4: Verificar no navegador**

Run: `python -m http.server 8000` e abra `http://localhost:8000` no Chrome, com o modo celular do DevTools em 360×740.
Expected:
- Lançar 1.200,00 Dinheiro + 800,00 Pix + saída 500,00: Féria R$ 2.000,00, Despesa R$ 500,00, Saldo R$ 1.500,00.
- Recarregar a página: os lançamentos continuam lá.
- Editar e excluir funcionam.
- Toque duplo rápido em Salvar grava um só lançamento.
- Uma descrição `<b>x</b>` aparece como texto literal.
- Nenhum erro no console.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: tela Hoje, lançamentos e IndexedDB"
```

---

### Task 6: Fechamento e histórico

**Files:**
- Create: `js/ui/closing-view.js`, `js/ui/history-view.js`
- Modify: `js/app.js` (rotas `#/fechar/...` e `#/historico`)

**Interfaces:**
- Consumes: `ctx`, `findDay`, `store.closeDay`, `formatBRL`, `formatLong`.
- Produces: `renderClosingView(root, ctx, date)`, `renderHistoryView(root, ctx)`.

- [ ] **Step 1: Tela de fechamento**

Mostre exatamente o esboço da spec, na ordem Féria, Dinheiro, Pix, Despesa, Saldo, Arnaldo (70%) e Gilmar (30%). Quando houver `prejuizoAnterior`, mostre abaixo da Despesa a linha "inclui prejuízo de DD/MM: R$ X". Com saldo zero ou negativo, mostre Arnaldo e Gilmar com R$ 0,00 e a frase "Prejuízo de R$ X vai como despesa para o próximo dia com movimento." Já com saldo zero, a frase é "Sem sobra hoje." O botão **Confirmar fechamento** chama `closeDay` e volta para a tela do dia. Se o dia não tiver lançamentos, mostre "Nada para fechar neste dia" e esconda o botão.

- [ ] **Step 2: Histórico**

A lista vem de `ledger.days` em ordem decrescente. Cada linha mostra a data longa, Féria, Despesa, Saldo (negativo em vermelho) e o selo Fechado/Aberto. Tocar numa linha abre `#/dia/<date>`. No topo, o botão **Lançar em outro dia** abre um `<input type="date" max="<hoje>">` e navega para `#/dia/<escolhida>`. Sem lançamentos, mostre "Nenhum dia lançado ainda".

- [ ] **Step 3: Verificar no navegador**

Expected:
- Com o exemplo da Task 5, fechar mostra Arnaldo R$ 1.050,00 e Gilmar R$ 450,00. O dia passa a "Fechado" e os botões de lançar somem.
- Em outro dia passado, lançar saída 400,00 e entrada 100,00: o dia mostra prejuízo de R$ 300,00. O próximo dia com movimento mostra a linha "Prejuízo de DD/MM" e a despesa inclui os R$ 300,00.
- Reabrir o dia do prejuízo e mudar a saída para 200,00: o dia seguinte passa a mostrar R$ 100,00.
- Um dia anterior aberto gera o aviso na tela Hoje.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: fechamento do dia e histórico"
```

---

### Task 7: Tela de backup e lembrete

**Files:**
- Create: `js/ui/backup-view.js`
- Modify: `js/app.js` (rota `#/backup`), `js/ui/day-view.js` (aviso de backup na tela Hoje)

**Interfaces:**
- Consumes: `buildBackup`, `backupFileName`, `parseBackup`, `BackupError`, `needsBackupReminder`, `store.replaceAll`, `store.getLastBackupAt`, `store.setLastBackupAt`.
- Produces: `renderBackupView(root, ctx)`.

- [ ] **Step 1: Exportar**

Mostre "Último backup: DD/MM às HH:MM" ou "Nenhum backup feito ainda". O botão **Exportar backup** monta um `File` JSON com o nome de `backupFileName`. Se `navigator.canShare?.({ files: [file] })`, use `navigator.share({ files: [file], title: 'Backup Controle de Loja' })`. Senão, baixe o arquivo por link `<a download>`. Grave `setLastBackupAt(now)` só depois de compartilhar ou baixar com sucesso. Se o usuário cancelar o compartilhamento (`AbortError`), não grave nada e não mostre erro.

- [ ] **Step 2: Importar**

O botão **Importar backup** abre um `<input type="file" accept=".json,application/json">`. Leia o texto e rode `parseBackup`. Se der `BackupError`, mostre "Este arquivo não é um backup válido do Controle de Loja. Nada foi alterado." Se o arquivo for válido, mostre `confirm("Isto vai substituir TODOS os dados deste celular pelos do backup de DD/MM (N lançamentos). Continuar?")`. Com confirmação, chame `replaceAll({ entries, days, lastBackupAt: exportedAt })` e mostre "Backup restaurado".

- [ ] **Step 3: Aviso na tela Hoje**

Se `needsBackupReminder` for verdadeiro, mostre no topo: "Faz mais de 7 dias sem backup. [Fazer backup]", com atalho para `#/backup`.

- [ ] **Step 4: Verificar no navegador**

Expected:
- Exportar baixa `controle-loja-backup-AAAA-MM-DD.json`.
- Limpar os dados do site (DevTools → Application → Clear site data) e importar o arquivo restaura tudo.
- Importar um `.json` qualquer mostra a mensagem de arquivo inválido e mantém os dados.
- Mudar `lastBackupAt` para 8 dias atrás (DevTools → IndexedDB) e editar um lançamento faz o aviso aparecer.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: exportar/importar backup e lembrete"
```

---

### Task 8: PWA (instalável e offline)

**Files:**
- Create: `manifest.webmanifest`, `sw.js`, `scripts/make_icons.py`, `icons/icon-192.png`, `icons/icon-512.png`
- Modify: `index.html` (link do manifest, `theme-color`, registro do SW), `js/app.js` (`navigator.storage.persist()`)

**Interfaces:**
- Produces: cache `controle-loja-v1` com a lista de todos os arquivos do app. Cada mudança futura nos arquivos exige subir a versão do cache.

- [ ] **Step 1: Ícones**

Escreva `scripts/make_icons.py` só com a biblioteca padrão (`zlib`, `struct`). Ele gera PNGs de 192 e 512 px com fundo de cor sólida e um símbolo simples centralizado, dentro da área segura de 80%, para funcionar como `maskable`. Run: `python scripts/make_icons.py`. Expected: os dois arquivos em `icons/`.

- [ ] **Step 2: Manifest e service worker**

Manifest: `"name": "Controle de Loja"`, `"short_name": "Loja"`, `"lang": "pt-BR"`, `"start_url": "./"`, `"scope": "./"`, `"display": "standalone"` e ícones com `"purpose": "any maskable"`. Service worker: no `install`, faz o precache da lista. No `activate`, apaga caches antigos. No `fetch`, responde primeiro do cache e, se não achar, vai à rede, e navegações caem em `./index.html`. Registre com `navigator.serviceWorker.register('./sw.js')`. Na inicialização, chame `navigator.storage?.persist?.()` e ignore o resultado.

- [ ] **Step 3: Verificar**

Expected:
- O DevTools → Lighthouse/Application mostra o app como instalável.
- Com o Service Worker ativo, marcar "Offline" e recarregar ainda abre o app com os dados.
- Os testes continuam passando (`npm test` → PASS).

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: PWA instalável e offline"
```

---

### Task 9: Publicar e instalar no celular

Esta task depende do usuário: ela publica o app na internet, então confirme com ele antes de cada passo externo.

- [ ] **Step 1: Escolher a hospedagem com o usuário**

- **(a) GitHub Pages:** precisa de uma conta GitHub. O repositório pode ser privado só em planos pagos. Num repositório público, o código fica visível, mas os dados não, porque eles ficam só no celular.
- **(b) Netlify Drop:** o usuário arrasta a pasta do app (sem `docs/`, `tests/` e `scripts/`) em app.netlify.com/drop e recebe um link.

- [ ] **Step 2: Publicar pela opção escolhida e abrir o link HTTPS no computador**

Expected: o app abre e funciona.

- [ ] **Step 3: Instalar no Android**

Passe ao usuário: abrir o link no Chrome, ir em menu ⋮, depois **Instalar app** (ou "Adicionar à tela inicial"). Expected: o ícone "Loja" aparece na tela inicial e o app abre em tela cheia, também em modo avião.

- [ ] **Step 4: Commit de qualquer ajuste de publicação**
