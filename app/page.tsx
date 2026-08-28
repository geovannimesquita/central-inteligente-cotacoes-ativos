import Dashboard from "./components/Dashboard";

/**
 * Pagina unica da aplicacao.
 *
 * O shell e um Server Component: ele nao carrega dado nem segredo. Todo o
 * consumo de API acontece no `Dashboard` (Client Component), que fala apenas
 * com as rotas internas `/api/*` — o browser nunca chama AwesomeAPI, CoinGecko
 * ou Airtable diretamente.
 */
export default function HomePage() {
  return <Dashboard />;
}
