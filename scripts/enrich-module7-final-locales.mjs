import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const localesDir = path.resolve(__dirname, "../ui/src/i18n/locales");

const enPath = path.join(localesDir, "en.json");
const ptPath = path.join(localesDir, "pt-BR.json");

const en = JSON.parse(fs.readFileSync(enPath, "utf8"));
const pt = JSON.parse(fs.readFileSync(ptPath, "utf8"));

// 1. sidebar
en.sidebar = en.sidebar || {};
pt.sidebar = pt.sidebar || {};

en.sidebar.newProject = "New project";
pt.sidebar.newProject = "Novo projeto";

en.sidebar.budgetPaused = "Project paused by budget";
pt.sidebar.budgetPaused = "Projeto pausado por orçamento";

// 2. workspaces.recovery
en.workspaces = en.workspaces || {};
pt.workspaces = pt.workspaces || {};
en.workspaces.recovery = en.workspaces.recovery || {};
pt.workspaces.recovery = pt.workspaces.recovery || {};

const recoveryEn = {
  whyDidThisHappen: "Why did this happen?",
  hideDetails: "Hide details",
  setting: "Setting",
  taskSpecificBranch: "Task-specific starting branch",
  workspaceStartingBranch: "Workspace starting branch",
  requestedBranch: "Requested branch",
  setBy: "Set by",
  whyStopped: "Why it stopped",
  taskBranchWhy: "An explicit task branch overrides the repository default. Paperclip does not silently switch branches.",
  workspaceBranchWhy: "The configured starting branch must resolve before the agent can start. This repair overrides it for this task.",
  validBranchError: "Enter a valid branch name, such as master or release/next.",
  refreshTaskError: "Refresh the task to check its current state, then try again.",
  cancel: "Cancel",
};

const recoveryPt = {
  whyDidThisHappen: "Por que isso aconteceu?",
  hideDetails: "Ocultar detalhes",
  setting: "Configuração",
  taskSpecificBranch: "Branch inicial específica da tarefa",
  workspaceStartingBranch: "Branch inicial do espaço de trabalho",
  requestedBranch: "Branch solicitada",
  setBy: "Definido por",
  whyStopped: "Por que parou",
  taskBranchWhy: "Uma branch explícita da tarefa substitui o padrão do repositório. O Paperclip não alterna branches silenciosamente.",
  workspaceBranchWhy: "A branch inicial configurada precisa ser resolvida antes que o agente possa iniciar. Este reparo a substitui para esta tarefa.",
  validBranchError: "Digite um nome de branch válido, como master ou release/next.",
  refreshTaskError: "Atualize a tarefa para verificar seu estado atual e tente novamente.",
  cancel: "Cancelar",
};

Object.assign(en.workspaces.recovery, recoveryEn);
Object.assign(pt.workspaces.recovery, recoveryPt);

// 3. workspaces.serviceControlBar
en.workspaces.serviceControlBar = en.workspaces.serviceControlBar || {};
pt.workspaces.serviceControlBar = pt.workspaces.serviceControlBar || {};

const serviceBarEn = {
  openInNewTab: "Open in new tab",
  start: "Start",
  stop: "Stop",
  restart: "Restart",
};

const serviceBarPt = {
  openInNewTab: "Abrir em nova aba",
  start: "Iniciar",
  stop: "Parar",
  restart: "Reiniciar",
};

Object.assign(en.workspaces.serviceControlBar, serviceBarEn);
Object.assign(pt.workspaces.serviceControlBar, serviceBarPt);

fs.writeFileSync(enPath, JSON.stringify(en, null, 2) + "\n", "utf8");
fs.writeFileSync(ptPath, JSON.stringify(pt, null, 2) + "\n", "utf8");

console.log("Successfully enriched en.json and pt-BR.json with final Module 7 keys.");
