# Atletas Energisa — Portal

Portal do programa de atletas Energisa: cadastro e acompanhamento de atletas,
lançamento de pontos, eventos, notícias, controle financeiro e gestão de
acessos, com três perfis (atleta, comitê, administrador).

Construído em Next.js (App Router) + TypeScript + Tailwind CSS + Firebase
(Auth + Firestore).

## Desenvolvimento local

O projeto roda contra o **Firebase Emulator Suite**, sem depender de nenhum
projeto Firebase real.

```bash
npm install

# Terminal 1 — emuladores (Auth + Firestore)
npm run emulators

# Terminal 2 — popula dados de teste (3 perfis)
npm run seed

# Terminal 3 — servidor Next.js
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000). Contas de teste criadas
pelo `npm run seed` (senha `senha123`):

| Perfil         | E-mail                          |
| -------------- | -------------------------------- |
| Administrador  | admin@energisa.com.br            |
| Comitê         | comite@energisa.com.br           |
| Atleta         | ana.corrida@energisa.com.br      |

## Checklist para publicar em produção

1. Criar um projeto no [Firebase Console](https://console.firebase.google.com).
2. Ativar **Authentication** (provedor E-mail/senha) e **Firestore Database**
   (modo produção) nesse projeto.
3. Copiar o `.env.example` para `.env.local` (ou configurar as mesmas
   variáveis no painel do host de deploy) e preencher com as credenciais do
   app Web (Configurações do projeto → Seus apps), com
   `NEXT_PUBLIC_USE_FIREBASE_EMULATOR=false`.
4. Publicar as regras e os índices do Firestore:
   ```bash
   firebase deploy --only firestore:rules,firestore:indexes --project <id-do-projeto>
   ```
5. Criar a primeira conta de administrador. As regras do Firestore exigem que
   quem cria/edita `usuarios`/`atletas` já seja administrador, então isso
   precisa de uma credencial que ignora as regras (Admin SDK):
   1. Gerar uma chave de serviço no Firebase Console (Configurações do
      projeto → Contas de serviço → Gerar nova chave privada) e salvar como
      `service-account.json` na raiz do projeto (já está no `.gitignore`).
   2. Rodar:
      ```bash
      GOOGLE_APPLICATION_CREDENTIALS=./service-account.json \
        npx tsx scripts/set-admin-producao.ts --email=voce@energisa.com.br --senha=SENHA --nome="Seu Nome"
      ```
      Funciona mesmo rodando de novo (idempotente) e força a senha informada,
      mesmo se a conta já existir no Authentication.
   3. Apagar `service-account.json` depois de usar (e revogar a chave no
      Console, se quiser).
   - `scripts/verificar-usuario.ts --email=...` faz uma leitura read-only do
     Auth + Firestore de uma conta, útil para conferir sem precisar de senha.
   - `scripts/cleanup-admin-placeholder.ts --email=...` remove uma conta
     criada por engano (Auth + documentos Firestore correspondentes).
6. Conectar o repositório a um host (ex.: [Vercel](https://vercel.com/new)) e
   configurar as mesmas variáveis de ambiente do passo 3 no painel do host.

O workflow em `.github/workflows/ci.yml` roda lint, checagem de tipos e build
a cada push/PR — não faz deploy (isso fica a cargo do host escolhido, ex.:
integração automática da Vercel com o GitHub).
