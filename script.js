const TREE_FILE =
  params.get("tree") === "2"
    ? "reflection-tree2.json"
    : "reflectionTree.json"; CHANGE THIS TO LOAD DIFFERENT TREE FILES

let treeData = null;
let currentNode = null;
let treeFormat = null; // 'targetMap' or 'decision'
let state = {
  answers: {},
  axis1: { internal: 0, external: 0 },
  axis2: { contribution: 0, entitlement: 0 },
  axis3: { self: 0, others: 0 }
};

const textEl = document.getElementById("node-text");
const optionsEl = document.getElementById("options-container");
const continueBtn = document.getElementById("continue-btn");

async function loadTree() {
  const res = await fetch(TREE_FILE);
  treeData = await res.json();
  
  // Auto-detect tree format
  detectTreeFormat();
  
  currentNode = treeData.nodes.find(n => n.id === "START");
  renderNode();
}

function detectTreeFormat() {
  // Check if nodes use targetMap (reflection-tree2 format)
  const hasTargetMap = treeData.nodes.some(n => n.targetMap);
  const hasDecisionNodes = treeData.nodes.some(n => n.type === "decision");
  
  if (hasTargetMap) {
    treeFormat = 'targetMap';
  } else if (hasDecisionNodes) {
    treeFormat = 'decision';
  } else {
    treeFormat = 'simple';
  }
}

function renderNode() {
  optionsEl.innerHTML = "";
  continueBtn.classList.add("hidden");

  if (!currentNode) return;

  textEl.textContent = interpolate(currentNode.text);

  if (currentNode.type === "question" && currentNode.options.length > 0) {
    currentNode.options.forEach(opt => {
      const btn = document.createElement("button");
      btn.textContent = opt;
      btn.onclick = () => handleAnswer(opt);
      optionsEl.appendChild(btn);
    });
  } else if (["reflection", "bridge", "start", "summary", "end"].includes(currentNode.type)) {
    continueBtn.classList.remove("hidden");
    continueBtn.onclick = goNext;
  } else if (currentNode.type === "decision") {
    handleDecision();
  }
}

function handleAnswer(answer) {
  state.answers[currentNode.id] = answer;

  if (currentNode.signal) updateSignal(currentNode.signal);

  let nextNode = null;
  
  if (treeFormat === 'targetMap') {
    // reflection-tree2 format: use targetMap if available
    if (currentNode.targetMap && currentNode.targetMap[answer]) {
      nextNode = treeData.nodes.find(n => n.id === currentNode.targetMap[answer]);
    } else if (currentNode.target) {
      // Fallback to target if targetMap doesn't specify this answer
      nextNode = treeData.nodes.find(n => n.id === currentNode.target);
    }
  } else if (treeFormat === 'decision' || treeFormat === 'simple') {
    // reflection-tree format: use decision nodes or direct routing
    nextNode = findChildDecisionOrNext(currentNode.id, answer);
  }
  
  currentNode = nextNode;
  renderNode();
}

function goNext() {
  const targetId = currentNode.target;
  if (targetId) {
    currentNode = treeData.nodes.find(n => n.id === targetId);
    renderNode();
  } else {
    const next = findNextByParent(currentNode.id);
    currentNode = next;
    renderNode();
  }
}

function updateSignal(signal) {
  const [axis, type] = signal.replace("axis", "").split(":");
  state[`axis${axis.trim()}`][type] += 1;
}

function findNextByParent(parentId) {
  return treeData.nodes.find(n => n.parentId === parentId);
}

function findChildDecisionOrNext(parentId, answer) {
  const decision = treeData.nodes.find(n => n.type === "decision" && n.parentId === parentId);
  if (!decision) return null;

  const routes = decision.options.split(";");
  for (let route of routes) {
    const [cond, target] = route.split(":");
    const choices = cond.replace("answer=", "").split("|");
    if (choices.includes(answer.trim())) {
      return treeData.nodes.find(n => n.id === target.trim());
    }
  }
  return null;
}

function interpolate(text) {
  if (!text) return "";
  return text.replace(/\{(.*?)\}/g, (_, key) => state.answers[key] || "");
}

loadTree();
