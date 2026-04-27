import express from "express";
import axios from "axios";
import crypto from "crypto";
import dotenv from "dotenv";
import fs from "node:fs/promises";
import { readFileSync } from "node:fs";
import https from "node:https";

dotenv.config();

const app = express();
const port = 8081;
const sslKey = readFileSync("./key.pem");
const sslCert = readFileSync("./cert.pem");
const server = https.createServer({ key: sslKey, cert: sslCert }, app);

// Configuration
const endpoint = process.env.SUPER_PDP_API_ENDPOINT;
const clientId = process.env.SUPER_PDP_ERP_CLIENT_ID;
const clientSecret = process.env.SUPER_PDP_ERP_CLIENT_SECRET;
const redirectUri = process.env.SUPER_PDP_ERP_OAUTH_REDIRECT_URL;
const TOKENS_FILE = "./tokens.json";

// --- JSON File Storage Helpers ---
async function getTokens() {
  try {
    const data = await fs.readFile(TOKENS_FILE, "utf-8");
    return JSON.parse(data);
  } catch (error) {
    return [];
  }
}

async function saveTokens(tokensArray) {
  await fs.writeFile(TOKENS_FILE, JSON.stringify(tokensArray, null, 2), "utf-8");
}
// ---------------------------------

app.get("/", async (req, res) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");

  const tokens = await getTokens();

  if (tokens.length === 0) {
    return res.send('Pas connecté.<br/><a href="/connect">Se connecter</a>');
  }

  let token = tokens[0];
  console.log("Current tokens:", token);

  try {
    // Try to call an api endpoint with actual token
    const response = await axios.get(`${endpoint}/v1.beta/companies/me`, {
      headers: { Authorization: `Bearer ${token.access_token}` },
    });
    return res.json(response.data);
  } catch (error) {
    if (error.response?.data?.http_status_code !== 401) {
      console.error("Erreur API (1):", error.response?.data || error.message);
      return res.status(500).send("Erreur lors de l'appel à l'API SUPER PDP (1).");
    }

    console.log("Token expired, refresh attempt...");

    try {
      const refreshResponse = await axios.post(
        `${endpoint}/oauth2/token`,
        new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: token.refresh_token,
          client_id: clientId,
          client_secret: clientSecret,
        }).toString(),
        {
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
        }
      );

      token = refreshResponse.data;
      await saveTokens([token]); // Sauvegarde dans le fichier JSON

    } catch (err) {
      console.error("Erreur Refresh:", err.response?.data || err.message);
      return res.status(500).send(
        'Impossible de rafraîchir le jeton de session. <br/><a href="/connect">Se connecter</a>'
      );
    }

    try {
      // New attempt with the refreshed token
      const retryResponse = await axios.get(`${endpoint}/v1.beta/companies/me`, {
        headers: { Authorization: `Bearer ${token.access_token}` },
      });
      return res.json(retryResponse.data);
    } catch (retryError) {
      console.error("Erreur API (2):", retryError.response?.data || retryError.message);
      return res.status(500).send("Erreur lors de l'appel à l'API SUPER PDP après rafraîchissement.");
    }
  }
});

app.get("/connect", (req, res) => {
  const state = crypto.randomBytes(16).toString("base64url");
  const authUrl = `${endpoint}/oauth2/authorize?` + new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    state: state,
    scope: "", // Add the necessary scopes here
  }).toString();

  res.redirect(authUrl);
});

app.get("/callback", async (req, res) => {
  const code = req.query.code;

  if (!code) {
    return res.status(400).send("Code d'autorisation manquant.");
  }

  try {
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
      }
    );

    const tokenData = response.data;
    await saveTokens([tokenData]); // Overwrite the old token with the new one

    res.json(tokenData);
  } catch (error) {
    console.error("Erreur d'échange de token:", error.response?.data || error.message);
    res.status(500).send("Erreur lors de l'échange du token OAuth2.");
  }
});

/**
 * The /revoke route should be treated strictly as a "Logout" mechanism
 */
app.get("/revoke", async (req, res) => {
  const accessToken = req.query.accessToken;

  if (!accessToken) {
    return res.status(400).send("Jeton de session manquant en paramètre de requête.");
  }

  const tokens = await getTokens();
  if (tokens.length === 0) {
    return res.status(400).send("Aucun token disponible localement pour le renouvellement.");
  }

  try {
    await axios.post(
      `${endpoint}/oauth2/revoke`,
      new URLSearchParams({
        token_type_hint: 'access_token',
        token: accessToken,
        client_id: clientId,
        client_secret: clientSecret,
      }).toString(),
      {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      }
    );
    console.log("Token révoqué avec succès.");
  } catch (error) {
    console.error("Erreur lors de la révocation:", error.response?.data || error.message);
    return res.status(500).send("Erreur lors de la révocation du token OAuth2.");
  }

  // 2. Clear our local storage
  await saveTokens([]); 

  // 3. Redirect the user back to the login screen
  res.send('Déconnecté avec succès.<br/><a href="/connect">Se reconnecter</a>');
});

server.listen(port, () => {
  console.log(`Serveur de démo lancé sur https://localhost:${port}`);
});