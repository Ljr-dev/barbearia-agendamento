const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcryptjs");
const session = require("express-session");
const path = require("path");

const app = express();
const db = new sqlite3.Database("./database.sqlite");

app.use(express.json());
app.use(express.static("public"));

app.use(session({
  secret: "barbearia_secreta",
  resave: false,
  saveUninitialized: false
}));

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT,
      email TEXT UNIQUE,
      senha TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS barbeiros (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS servicos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      preco REAL NOT NULL,
      duracao INTEGER DEFAULT 30
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS agendamentos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cliente TEXT NOT NULL,
      telefone TEXT NOT NULL,
      barbeiro_id INTEGER,
      servico_id INTEGER,
      data TEXT NOT NULL,
      horario TEXT NOT NULL,
      status TEXT DEFAULT 'agendado'
    )
  `);

  const senhaHash = bcrypt.hashSync("123456", 10);

  db.run(`
    INSERT OR IGNORE INTO usuarios (id, nome, email, senha)
    VALUES (1, 'Dono da Barbearia', 'admin@barbearia.com', ?)
  `, [senhaHash]);
});

function proteger(req, res, next) {
  if (!req.session.usuario) {
    return res.status(401).json({ erro: "Não autorizado" });
  }

  next();
}

app.post("/api/login", (req, res) => {
  const { email, senha } = req.body;

  db.get("SELECT * FROM usuarios WHERE email = ?", [email], (err, usuario) => {
    if (!usuario) {
      return res.status(401).json({ erro: "Usuário não encontrado" });
    }

    const senhaCorreta = bcrypt.compareSync(senha, usuario.senha);

    if (!senhaCorreta) {
      return res.status(401).json({ erro: "Senha inválida" });
    }

    req.session.usuario = {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email
    };

    res.json({ sucesso: true });
  });
});

app.post("/api/logout", (req, res) => {
  req.session.destroy();
  res.json({ sucesso: true });
});

app.get("/api/verificar-login", (req, res) => {
  res.json({ logado: !!req.session.usuario });
});

app.get("/api/barbeiros", (req, res) => {
  db.all("SELECT * FROM barbeiros ORDER BY nome", [], (err, rows) => {
    res.json(rows);
  });
});

app.post("/api/barbeiros", proteger, (req, res) => {
  const { nome } = req.body;

  db.run("INSERT INTO barbeiros (nome) VALUES (?)", [nome], function () {
    res.json({ id: this.lastID, nome });
  });
});

app.delete("/api/barbeiros/:id", proteger, (req, res) => {
  db.run("DELETE FROM barbeiros WHERE id = ?", [req.params.id], () => {
    res.json({ sucesso: true });
  });
});

app.get("/api/servicos", (req, res) => {
  db.all("SELECT * FROM servicos ORDER BY nome", [], (err, rows) => {
    res.json(rows);
  });
});

app.post("/api/servicos", proteger, (req, res) => {
  const { nome, preco, duracao } = req.body;

  db.run(
    "INSERT INTO servicos (nome, preco, duracao) VALUES (?, ?, ?)",
    [nome, preco, duracao],
    function () {
      res.json({ id: this.lastID, nome, preco, duracao });
    }
  );
});

app.delete("/api/servicos/:id", proteger, (req, res) => {
  db.run("DELETE FROM servicos WHERE id = ?", [req.params.id], () => {
    res.json({ sucesso: true });
  });
});

app.get("/api/dias-disponiveis", (req, res) => {
  const dias = [];

  for (let i = 0; i < 7; i++) {
    const data = new Date();
    data.setDate(data.getDate() + i);

    dias.push(data.toISOString().split("T")[0]);
  }

  res.json(dias);
});

app.get("/api/horarios-disponiveis", (req, res) => {
  const { data, barbeiro_id } = req.query;

  const horariosBase = [
    "09:00", "09:30", "10:00", "10:30",
    "11:00", "11:30", "14:00", "14:30",
    "15:00", "15:30", "16:00", "16:30",
    "17:00", "17:30"
  ];

  db.all(
    `
    SELECT horario FROM agendamentos
    WHERE data = ?
    AND barbeiro_id = ?
    AND status = 'agendado'
    `,
    [data, barbeiro_id],
    (err, agendados) => {
      const ocupados = agendados.map(item => item.horario);
      const disponiveis = horariosBase.filter(h => !ocupados.includes(h));

      res.json(disponiveis);
    }
  );
});

app.post("/api/agendamentos", (req, res) => {
  const { cliente, telefone, barbeiro_id, servico_id, data, horario } = req.body;

  db.get(
    `
    SELECT * FROM agendamentos
    WHERE barbeiro_id = ?
    AND data = ?
    AND horario = ?
    AND status = 'agendado'
    `,
    [barbeiro_id, data, horario],
    (err, existente) => {
      if (existente) {
        return res.status(400).json({ erro: "Horário já ocupado" });
      }

      db.run(
        `
        INSERT INTO agendamentos 
        (cliente, telefone, barbeiro_id, servico_id, data, horario)
        VALUES (?, ?, ?, ?, ?, ?)
        `,
        [cliente, telefone, barbeiro_id, servico_id, data, horario],
        function () {
          res.json({ sucesso: true, id: this.lastID });
        }
      );
    }
  );
});

app.get("/api/agendamentos", proteger, (req, res) => {
  db.all(`
    SELECT 
      agendamentos.id,
      agendamentos.cliente,
      agendamentos.telefone,
      agendamentos.data,
      agendamentos.horario,
      agendamentos.status,
      barbeiros.nome AS barbeiro,
      servicos.nome AS servico,
      servicos.preco
    FROM agendamentos
    LEFT JOIN barbeiros ON barbeiros.id = agendamentos.barbeiro_id
    LEFT JOIN servicos ON servicos.id = agendamentos.servico_id
    ORDER BY agendamentos.data, agendamentos.horario
  `, [], (err, rows) => {
    res.json(rows);
  });
});

app.patch("/api/agendamentos/:id/cancelar", proteger, (req, res) => {
  db.run(
    "UPDATE agendamentos SET status = 'cancelado' WHERE id = ?",
    [req.params.id],
    () => res.json({ sucesso: true })
  );
});

app.patch("/api/agendamentos/:id/finalizar", proteger, (req, res) => {
  db.run(
    "UPDATE agendamentos SET status = 'finalizado' WHERE id = ?",
    [req.params.id],
    () => res.json({ sucesso: true })
  );
});

app.listen(3000, () => {
  console.log("Servidor rodando em http://localhost:3000");
});