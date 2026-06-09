const pagina = window.location.pathname;

async function api(url, options = {}) {
  const resposta = await fetch(url, {
    headers: {
      "Content-Type": "application/json"
    },
    ...options
  });

  const dados = await resposta.json();

  if (!resposta.ok) {
    return {
      erro: dados.erro || "Erro na requisição"
    };
  }

  return dados;
}

if (pagina === "/" || pagina.includes("index.html")) {
  carregarProfissionaisHome();
}

if (pagina.includes("agendamento.html")) {
  iniciarAgendamento();
}

if (pagina.includes("painel.html")) {
  iniciarPainel();
}

async function carregarProfissionaisHome() {
  const lista = document.getElementById("listaProfissionaisHome");

  if (!lista) return;

  const barbeiros = await api("/api/barbeiros");

  lista.innerHTML = "";

  if (!Array.isArray(barbeiros) || barbeiros.length === 0) {
    lista.innerHTML = `
      <article class="pro-card">
        <div class="avatar">!</div>
        <h3>Nenhum profissional cadastrado</h3>
        <p>Cadastre barbeiros no painel para eles aparecerem aqui automaticamente.</p>
      </article>
    `;
    return;
  }

  barbeiros.forEach(barbeiro => {
    const inicial = barbeiro.nome.charAt(0).toUpperCase();

    lista.innerHTML += `
      <article class="pro-card">
        <div class="avatar">${inicial}</div>
        <h3>${barbeiro.nome}</h3>
        <p>Profissional cadastrado para atendimento na barbearia.</p>
      </article>
    `;
  });
}

async function iniciarAgendamento() {
  const barbeiroSelect = document.getElementById("barbeiro");
  const servicoSelect = document.getElementById("servico");
  const dataSelect = document.getElementById("data");
  const horarioSelect = document.getElementById("horario");
  const form = document.getElementById("formAgendamento");

  const barbeiros = await api("/api/barbeiros");
  const servicos = await api("/api/servicos");
  const dias = await api("/api/dias-disponiveis");

  if (Array.isArray(barbeiros) && barbeiros.length === 0) {
    barbeiroSelect.innerHTML = `<option value="">Nenhum barbeiro cadastrado</option>`;
  }

  if (Array.isArray(servicos) && servicos.length === 0) {
    servicoSelect.innerHTML = `<option value="">Nenhum serviço cadastrado</option>`;
  }

  if (Array.isArray(barbeiros)) {
    barbeiros.forEach(barbeiro => {
      barbeiroSelect.innerHTML += `
        <option value="${barbeiro.id}">${barbeiro.nome}</option>
      `;
    });
  }

  if (Array.isArray(servicos)) {
    servicos.forEach(servico => {
      servicoSelect.innerHTML += `
        <option value="${servico.id}">
          ${servico.nome} - R$ ${Number(servico.preco).toFixed(2)}
        </option>
      `;
    });
  }

  if (Array.isArray(dias)) {
    dias.forEach(dia => {
      dataSelect.innerHTML += `
        <option value="${dia}">${formatarData(dia)}</option>
      `;
    });
  }

  async function carregarHorarios() {
    const data = dataSelect.value;
    const barbeiro_id = barbeiroSelect.value;

    horarioSelect.innerHTML = `<option value="">Escolha o horário</option>`;

    if (!data || !barbeiro_id) return;

    const horarios = await api(`/api/horarios-disponiveis?data=${data}&barbeiro_id=${barbeiro_id}`);

    if (!Array.isArray(horarios) || horarios.length === 0) {
      horarioSelect.innerHTML = `<option value="">Nenhum horário disponível</option>`;
      return;
    }

    horarios.forEach(horario => {
      horarioSelect.innerHTML += `
        <option value="${horario}">${horario}</option>
      `;
    });
  }

  dataSelect.addEventListener("change", carregarHorarios);
  barbeiroSelect.addEventListener("change", carregarHorarios);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const dados = {
      cliente: document.getElementById("cliente").value.trim(),
      telefone: document.getElementById("telefone").value.trim(),
      barbeiro_id: barbeiroSelect.value,
      servico_id: servicoSelect.value,
      data: dataSelect.value,
      horario: horarioSelect.value
    };

    if (!dados.cliente || !dados.telefone || !dados.barbeiro_id || !dados.servico_id || !dados.data || !dados.horario) {
      alert("Preencha todos os campos.");
      return;
    }

    const resposta = await api("/api/agendamentos", {
      method: "POST",
      body: JSON.stringify(dados)
    });

    if (resposta.erro) {
      alert(resposta.erro);
      return;
    }

    alert("Agendamento realizado com sucesso!");

    form.reset();
    horarioSelect.innerHTML = `<option value="">Escolha o horário</option>`;
  });
}

async function iniciarPainel() {
  const loginBox = document.getElementById("loginBox");
  const painelBox = document.getElementById("painelBox");
  const sidebar = document.querySelector(".sidebar");

  if (sidebar) {
    sidebar.style.display = "none";
  }

  const status = await api("/api/verificar-login");

  if (status.logado) {
    loginBox.classList.add("oculto");
    painelBox.classList.remove("oculto");

    if (sidebar) {
      sidebar.style.display = "flex";
    }

    carregarPainel();
  }

  document.getElementById("formLogin").addEventListener("submit", async (e) => {
    e.preventDefault();

    const resposta = await api("/api/login", {
      method: "POST",
      body: JSON.stringify({
        email: document.getElementById("email").value,
        senha: document.getElementById("senha").value
      })
    });

    if (resposta.erro) {
      alert(resposta.erro);
      return;
    }

    loginBox.classList.add("oculto");
    painelBox.classList.remove("oculto");

    if (sidebar) {
      sidebar.style.display = "flex";
    }

    carregarPainel();
  });
}

function carregarPainel() {
  carregarBarbeiros();
  carregarServicos();
  carregarAgendamentos();

  const formBarbeiro = document.getElementById("formBarbeiro");
  const formServico = document.getElementById("formServico");

  formBarbeiro.addEventListener("submit", async (e) => {
    e.preventDefault();

    const nome = document.getElementById("nomeBarbeiro").value.trim();

    if (!nome) {
      alert("Informe o nome do barbeiro.");
      return;
    }

    await api("/api/barbeiros", {
      method: "POST",
      body: JSON.stringify({ nome })
    });

    e.target.reset();
    carregarBarbeiros();
  });

  formServico.addEventListener("submit", async (e) => {
    e.preventDefault();

    const nome = document.getElementById("nomeServico").value.trim();
    const preco = document.getElementById("precoServico").value;
    const duracao = document.getElementById("duracaoServico").value;

    if (!nome || !preco || !duracao) {
      alert("Preencha todos os dados do serviço.");
      return;
    }

    await api("/api/servicos", {
      method: "POST",
      body: JSON.stringify({
        nome,
        preco,
        duracao
      })
    });

    e.target.reset();
    document.getElementById("duracaoServico").value = 30;
    carregarServicos();
  });
}

async function carregarBarbeiros() {
  const lista = document.getElementById("listaBarbeiros");

  if (!lista) return;

  const barbeiros = await api("/api/barbeiros");

  lista.innerHTML = "";

  if (!Array.isArray(barbeiros) || barbeiros.length === 0) {
    lista.innerHTML = `<li>Nenhum barbeiro cadastrado.</li>`;
    return;
  }

  barbeiros.forEach(item => {
    lista.innerHTML += `
      <li>
        <div>
          <strong>${item.nome}</strong>
          <small>Profissional cadastrado</small>
        </div>
        <button onclick="excluirBarbeiro(${item.id})">Excluir</button>
      </li>
    `;
  });
}

async function carregarServicos() {
  const lista = document.getElementById("listaServicos");

  if (!lista) return;

  const servicos = await api("/api/servicos");

  lista.innerHTML = "";

  if (!Array.isArray(servicos) || servicos.length === 0) {
    lista.innerHTML = `<li>Nenhum serviço cadastrado.</li>`;
    return;
  }

  servicos.forEach(item => {
    lista.innerHTML += `
      <li>
        <div>
          <strong>${item.nome}</strong>
          <small>R$ ${Number(item.preco).toFixed(2)} • ${item.duracao} min</small>
        </div>
        <button onclick="excluirServico(${item.id})">Excluir</button>
      </li>
    `;
  });
}

async function carregarAgendamentos() {
  const lista = document.getElementById("listaAgendamentos");

  if (!lista) return;

  const agendamentos = await api("/api/agendamentos");

  lista.innerHTML = "";

  if (!Array.isArray(agendamentos) || agendamentos.length === 0) {
    lista.innerHTML = `
      <tr>
        <td colspan="7">Nenhum agendamento encontrado.</td>
      </tr>
    `;

    atualizarEstatisticas([]);
    return;
  }

  agendamentos.forEach(item => {
    lista.innerHTML += `
      <tr>
        <td>${formatarData(item.data)}</td>
        <td>${item.horario}</td>
        <td>
          <strong>${item.cliente}</strong><br>
          <small>${item.telefone}</small>
        </td>
        <td>${item.barbeiro || "-"}</td>
        <td>${item.servico || "-"}</td>
        <td>
          <span class="status ${item.status}">
            ${capitalizar(item.status)}
          </span>
        </td>
        <td>
          <button class="action-btn action-ok" onclick="finalizarAgendamento(${item.id})">✓</button>
          <button class="action-btn action-cancel" onclick="cancelarAgendamento(${item.id})">×</button>
        </td>
      </tr>
    `;
  });

  atualizarEstatisticas(agendamentos);
}

function atualizarEstatisticas(agendamentos) {
  const hoje = new Date();
  const amanha = new Date();

  amanha.setDate(hoje.getDate() + 1);

  const hojeStr = hoje.toISOString().split("T")[0];
  const amanhaStr = amanha.toISOString().split("T")[0];

  const ativos = agendamentos.filter(item => item.status === "agendado");

  const totalHoje = ativos.filter(item => item.data === hojeStr).length;
  const totalAmanha = ativos.filter(item => item.data === amanhaStr).length;
  const totalSemana = ativos.length;
  const cancelados = agendamentos.filter(item => item.status === "cancelado").length;

  const statHoje = document.getElementById("statHoje");
  const statAmanha = document.getElementById("statAmanha");
  const statSemana = document.getElementById("statSemana");
  const statCancelados = document.getElementById("statCancelados");

  if (statHoje) statHoje.textContent = totalHoje;
  if (statAmanha) statAmanha.textContent = totalAmanha;
  if (statSemana) statSemana.textContent = totalSemana;
  if (statCancelados) statCancelados.textContent = cancelados;
}

async function excluirBarbeiro(id) {
  if (!confirm("Deseja excluir este barbeiro?")) return;

  await api(`/api/barbeiros/${id}`, {
    method: "DELETE"
  });

  carregarBarbeiros();
}

async function excluirServico(id) {
  if (!confirm("Deseja excluir este serviço?")) return;

  await api(`/api/servicos/${id}`, {
    method: "DELETE"
  });

  carregarServicos();
}

async function cancelarAgendamento(id) {
  if (!confirm("Cancelar este agendamento?")) return;

  await api(`/api/agendamentos/${id}/cancelar`, {
    method: "PATCH"
  });

  carregarAgendamentos();
}

async function finalizarAgendamento(id) {
  if (!confirm("Finalizar este atendimento?")) return;

  await api(`/api/agendamentos/${id}/finalizar`, {
    method: "PATCH"
  });

  carregarAgendamentos();
}

async function logout() {
  await api("/api/logout", {
    method: "POST"
  });

  location.reload();
}

function formatarData(data) {
  if (!data) return "-";

  const [ano, mes, dia] = data.split("-");
  return `${dia}/${mes}/${ano}`;
}

function capitalizar(texto) {
  if (!texto) return "";
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}