/**
 * Diagnostico da credencial da AwesomeAPI.
 *
 * A AwesomeAPI limita o acesso publico POR IP. Em maquina local isso passa
 * despercebido, mas em hospedagem serverless o IP de saida e compartilhado e a
 * cota chega esgotada (HTTP 429) — por isso o token deixa de ser opcional ao
 * publicar. Este script confere, em segundos, se a chave configurada e aceita,
 * evitando descobrir o problema so depois de um deploy.
 *
 * Uso: npm run check:awesomeapi
 *
 * Nunca imprime o valor do token: apenas presenca, formato e o veredito da API.
 */

const ENDPOINT = "https://economia.awesomeapi.com.br/json/last/USD-BRL";
const token = process.env.AWESOMEAPI_TOKEN?.trim();

function linha(rotulo, valor) {
  console.log(`  ${rotulo.padEnd(26)} ${valor}`);
}

console.log("\nAwesomeAPI — diagnostico da credencial\n");

if (!token) {
  linha("AWESOMEAPI_TOKEN", "ausente");
  console.log(
    "\n  Sem token a aplicacao usa o acesso publico, que funciona localmente\n" +
      "  mas retorna HTTP 429 em hospedagem serverless.\n" +
      "  Crie a chave em https://awesomeapi.com.br/auth/signup e adicione ao .env.local.\n",
  );
  // `exitCode` em vez de `process.exit()`: encerrar a forca com sockets do fetch
  // ainda abertos dispara uma assercao do libuv no Windows.
  process.exitCode = 1;
} else {
  linha("AWESOMEAPI_TOKEN", `presente (${token.length} caracteres)`);
  linha("formato", /^[A-Za-z0-9._-]+$/.test(token) ? "ok" : "contem caractere inesperado");

  // Compara o acesso publico com o autenticado: se o publico responde e o
  // autenticado nao, o problema esta na chave, e nao na rede nem no endpoint.
  const [publico, autenticado] = await Promise.all([
    fetch(ENDPOINT)
      .then((r) => r.status)
      .catch(() => 0),
    fetch(`${ENDPOINT}?token=${encodeURIComponent(token)}`)
      .then(async (r) => ({ status: r.status, corpo: (await r.text()).slice(0, 120) }))
      .catch((e) => ({ status: 0, corpo: e.message })),
  ]);

  linha("acesso publico", publico === 0 ? "sem resposta" : `HTTP ${publico}`);
  linha(
    "acesso com token",
    autenticado.status === 0 ? "sem resposta" : `HTTP ${autenticado.status}`,
  );

  if (autenticado.status === 200) {
    console.log("\n  Chave valida. Pode publicar com ela.\n");
  } else {
    console.log(`\n  Resposta da API: ${autenticado.corpo}\n`);

    if (autenticado.status === 403) {
      console.log(
        "  A API leu a chave e a recusou. Verifique, nessa ordem:\n" +
          "    1. o e-mail do cadastro foi confirmado (a chave so ativa depois disso);\n" +
          "    2. o valor copiado e mesmo o da secao API Keys da sua conta;\n" +
          "    3. gere uma chave nova no painel e substitua no .env.local.\n",
      );
    } else if (autenticado.status === 429) {
      console.log("  Limite de requisicoes atingido para esta chave ou IP.\n");
    }

    process.exitCode = 1;
  }
}
