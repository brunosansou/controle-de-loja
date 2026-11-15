# Controle de Loja — Design

Data: 2026-11-15

## Intenção

O dono da loja quer registrar, ao longo do dia, as entradas e saídas de dinheiro da loja pelo próprio celular e, ao fechar o expediente, ver automaticamente:

- a **féria total do dia** (soma das entradas);
- a **despesa total do dia** (soma das saídas);
- **quanto sobrou para cada sócio**: Arnaldo 70%, Gilmar 30%.

Também quer consultar qualquer dia já lançado. O app é de uso pessoal, de uma pessoa só, em um celular Android. Se um dia os sócios precisarem acessar, isso será outro projeto. Este app não precisa se preparar para isso.

## Objetivos

1. Lançar uma entrada ou saída em poucos toques, no balcão.
2. Fechar o dia e ver os totais e a divisão entre os sócios sem fazer conta nenhuma.
3. Consultar qualquer dia já lançado.
4. Não perder o histórico quando trocar de celular ou o aparelho quebrar.

## Não-objetivos (fora deste projeto)

- Mais de um usuário, login ou sincronização entre aparelhos.
- Forma de pagamento nas saídas.
- Conferência de dinheiro na gaveta.
- Controle de estoque, produtos e notas fiscais.
- Relatórios mensais ou semanais (só a consulta dia a dia). Podem vir depois.
- Backup automático na nuvem (só a exportação manual). Pode vir depois.

## Anti-objetivos (seria um fracasso mesmo funcionando)

- **Conta errada:** a divisão ou o prejuízo levado para o dia seguinte não fecha com o que o dono faria na mão.
- **Perda do histórico** sem que o dono tenha sido avisado de que estava sem backup.
- **Lançar demorar mais do que anotar num caderno.**

## Regras de negócio

### Lançamento
- Tipo: **entrada** ou **saída**.
- **Valor** em reais, obrigatório e maior que zero.
- **Descrição** opcional (ex.: "venda balcão", "fornecedor de pão").
- **Forma de pagamento:** só nas entradas, **Dinheiro** ou **Pix**, obrigatória. O padrão sugerido é Dinheiro.
- **Hora:** registrada automaticamente.
- Pertence a um **dia** (data do calendário). Por padrão é o dia de hoje.
- Pode ser editado ou excluído enquanto o dia está aberto.

### Fechamento do dia
- Féria = soma das entradas, mostrando também o total em Dinheiro e o total em Pix.
- Despesa = soma das saídas + prejuízo trazido do dia anterior, se houver (ver abaixo).
- Saldo = Féria − Despesa.
- Se o saldo for **maior que zero**:
  - Arnaldo = 70% do saldo, arredondado ao centavo.
  - Gilmar = saldo − parte do Arnaldo, para que a soma bata exatamente com o saldo.
- Se o saldo for **zero ou negativo**, nenhum sócio recebe nada naquele dia.
- O botão **"Fechar dia"** mostra o resumo e marca o dia como fechado.
- Os totais parciais ficam visíveis durante o dia, antes do fechamento.

### Prejuízo passa para o dia seguinte
- Se um dia terminar com saldo negativo, o valor do prejuízo entra como **despesa automática** no **próximo dia que tiver lançamentos**, com a descrição "Prejuízo de DD/MM". Dias sem movimento (ex.: domingo fechado) são pulados.
- O prejuízo se acumula: se o dia seguinte também fechar negativo, já contando o prejuízo herdado, o novo prejuízo passa adiante.
- A despesa automática não pode ser editada nem excluída à mão. O app sempre a recalcula a partir do dia anterior.
- Enquanto o dia de hoje não tem lançamentos, a tela inicial mostra o prejuízo pendente como aviso ("Prejuízo de 14/11, R$ X, entra como despesa no primeiro lançamento de hoje"). Ele só passa a contar nos totais quando houver o primeiro lançamento. *(Decisão minha.)*

### Corrigir um dia fechado
- Um dia fechado pode ser **reaberto** para corrigir lançamentos e depois fechado de novo.
- Se a correção mudar o prejuízo levado adiante, as despesas automáticas dos dias seguintes são atualizadas e os totais deles mudam. O app avisa ao reabrir: "Corrigir este dia pode alterar os dias seguintes".

### Dia anterior não fechado
- Se houver um dia passado com lançamentos que não foi fechado, a tela inicial mostra um aviso com atalho para fechá-lo. Os cálculos desse dia valem normalmente, inclusive o prejuízo levado adiante.

### Histórico
- Lista de todos os dias com lançamentos, do mais recente para o mais antigo. Cada linha mostra a data, a féria, a despesa, o saldo e se o dia está fechado ou aberto.
- Tocar num dia abre o detalhe: os lançamentos e o resumo do fechamento.

### Backup
- O botão **"Exportar backup"** gera um arquivo com todos os dados. No Android, ele abre a tela de compartilhar, para salvar no Drive ou mandar no WhatsApp. Se compartilhar não estiver disponível, o arquivo é baixado.
- **"Importar backup"** restaura os dados de um arquivo. Ele substitui tudo o que está no app, depois de uma confirmação clara.
- Se passar **7 dias** sem backup e houver lançamentos novos, aparece um aviso na tela inicial.

## Telas (esboço)

```
┌ Hoje — sáb 15/11 ─────────────┐   ┌ Fechamento — 15/11 ───────────┐
│ Féria     R$ 1.240,00         │   │ Féria          R$ 2.000,00    │
│ Despesa   R$   310,00         │   │   Dinheiro     R$ 1.200,00    │
│ Saldo     R$   930,00         │   │   Pix          R$   800,00    │
│                               │   │ Despesa        R$   500,00    │
│ [+ Entrada]   [− Saída]       │   │ Saldo          R$ 1.500,00    │
│                               │   │ ───────────────────────────── │
│ 14:02 Venda balcão  Pix  +80  │   │ Arnaldo (70%)  R$ 1.050,00    │
│ 13:40 Fornecedor        −150  │   │ Gilmar  (30%)  R$   450,00    │
│ ...                           │   │                               │
│ [Fechar dia]                  │   │ [Confirmar fechamento]        │
└ Hoje | Histórico | Backup ────┘   └───────────────────────────────┘
```

Ao lançar: um teclado numérico abre direto no valor, há um campo de descrição, a escolha Dinheiro/Pix (só nas entradas) e o botão Salvar.

## Restrições

- Celular Android, usado no balcão com uma mão. Os botões precisam ser grandes e o lançamento rápido.
- Precisa funcionar **sem internet** depois de instalado.
- Custo zero de operação.
- Dados só no aparelho.
- Interface em português do Brasil, com valores no formato R$ 1.234,56.

## Abordagens consideradas

1. **App web instalável (PWA) — escolhida pelo dono.** Abre por um link, é instalado na tela inicial e funciona offline. Os dados ficam no aparelho. É o caminho mais rápido de construir, tem hospedagem gratuita e as atualizações são simples. O ponto fraco é que os dados podem ser apagados se o app não estiver instalado ou se o dono limpar os dados do navegador. A mitigação é instalar na tela inicial, pedir armazenamento persistente e o backup com lembrete.
2. **App Android nativo (.apk):** os dados ficam mais protegidos, mas a construção dá mais trabalho e cada atualização exige instalar um arquivo novo. Foi descartado por não compensar para um app de uso pessoal.
3. **Google Planilhas com formulário:** sem programação e com backup automático. Foi descartado porque usar no celular é desajeitado e a regra do prejuízo levado adiante ficaria frágil.

## Decisões de como construir (já tomadas)

- **Formato:** PWA instalável, com manifest e service worker para funcionar offline.
- **Dados:** guardados no próprio aparelho, em IndexedDB. O app pede armazenamento persistente (`navigator.storage.persist()`).
- **Dinheiro:** valores guardados como **inteiros em centavos**, para não haver erro de arredondamento.
- **Valores calculados:** totais, saldo, divisão e prejuízo levado adiante são **calculados a partir dos lançamentos** sempre que necessário, e não guardados. Assim as correções se propagam sozinhas. Só ficam guardados os lançamentos, o estado aberto/fechado de cada dia e a data do último backup.
- **Arquivo de backup:** JSON com um número de versão do formato.
- **Hospedagem:** gratuita, com HTTPS (necessário para instalar). Opções: GitHub Pages ou Netlify. A publicação precisa de uma conta do dono e será combinada com ele.

## Fica a critério de quem construir

- Biblioteca ou framework, ou nenhum. Preferir algo simples e sem dependência pesada.
- Visual, cores e tipografia, desde que legível no balcão e com botões grandes.
- Estrutura de pastas, testes e ferramentas.
- Nome do arquivo de backup e o texto exato dos avisos.
- Como escolher outra data para lançar (ex.: registrar um dia esquecido).

## Decisões que tomei e o dono deve conferir

- O prejuízo vai para o próximo dia **com lançamentos**, pulando os dias sem movimento.
- A descrição do lançamento é opcional.
- Dinheiro é a forma padrão sugerida nas entradas.
- Um dia fechado pode ser reaberto para correção.
- O aviso de backup aparece depois de 7 dias.
- Não há relatório mensal neste projeto.
- Um prejuízo pendente aparece como aviso em hoje e só entra na conta no primeiro lançamento do dia.
