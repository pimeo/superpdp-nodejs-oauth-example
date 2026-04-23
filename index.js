import express from "express"
import axios from "axios"
import crypto from "crypto"
import dotenv from "dotenv"
import fs from "node:fs"
import https from "node:https"

dotenv.config();

const app = express();
const port = 8081;
const sslKey = fs.readFileSync('./key.pem');
const sslCert = fs.readFileSync('./cert.pem');
const server = https.createServer({key: sslKey, cert: sslCert}, app)

// Configuration
const endpoint = process.env.SUPER_PDP_API_ENDPOINT;
const clientId = process.env.SUPER_PDP_ERP_CLIENT_ID;
const clientSecret = process.env.SUPER_PDP_ERP_CLIENT_SECRET;
const redirectUri = process.env.SUPER_PDP_ERP_OAUTH_REDIRECT_URL;


// Variables pour stocker les tokens (simule le slice 'tokens' en Go)
let tokens = [];

// Page d'accueil du logiciel de gestion qui n'affiche qu'un bouton "Se connecter"
// pour initier le tunnel d'inscription et le flow Authorization Code
app.get("/", async (req, res) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");

  if (tokens.length === 0) {
    res.send('Pas connecté.<br/><a href="/connect">Se connecter</a>');
  } else {
    try {
      const token = tokens[0];
      // Utilisation du token pour appeler l'API
      const response = await axios.get(`${endpoint}/v1.beta/companies/me`, {
        headers: { Authorization: `Bearer ${token.access_token}` },
      });
      res.json(response.data);
    } catch (error) {
      console.error("Erreur API:", error.response?.data || error.message);
      res.status(500).send("Erreur lors de l'appel à l'API SUPER PDP.");
    }
  }
});

// Redirection vers le tunnel d'inscription SUPER PDP
app.get("/connect", (req, res) => {
  // Génération d'un state aléatoire
  const state = crypto.randomBytes(16).toString("base64url");

  const authUrl =
    `${endpoint}/oauth2/authorize?` +
    new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      redirect_uri: redirectUri,
      state: state,
      scope: "", // Ajouter les scopes nécessaires ici
    }).toString();

  res.redirect(authUrl);
});

// À la fin du tunnel d'inscription, l'utilisateur est redirigé sur cette route
app.get("/callback", async (req, res) => {
  console.log('res', res)
  console.log('req', req)
  const code = req.query.code;

  if (!code) {
    return res.status(400).send("Code d'autorisation manquant.");
  }

  try {
    // Échange du code d'autorisation contre les tokens
    const response = await axios.post(
      `${endpoint}/oauth2/token`,
      new URLSearchParams({
        grant_type: "authorization_code",
        code: code,
        redirect_uri: redirectUri,
        client_id: clientId,
        client_secret: clientSecret,
      }).toString(),
      {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      },
    );

    const tokenData = response.data;
    tokens.push(tokenData);

    res.json(tokenData);
  } catch (error) {
    console.error(
      "Erreur d'échange de token:",
      error.response?.data || error.message,
    );
    res.status(500).send("Erreur lors de l'échange du token OAuth2.");
  }
});

server.listen(port, () => {
  console.log(`Serveur de démo lancé sur https://localhost:${port}`);
});
