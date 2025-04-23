import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import fetch from "node-fetch";
import { PublicClientApplication } from "@azure/msal-node";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CACHE_FILE_PATH = path.join(__dirname, "cache.json");

const fileBasedCachePlugin = {
  beforeCacheAccess: async (cacheContext) => {
    if (fs.existsSync(CACHE_FILE_PATH)) {
      const data = fs.readFileSync(CACHE_FILE_PATH, "utf-8");
      cacheContext.tokenCache.deserialize(data);
    }
  },
  afterCacheAccess: async (cacheContext) => {
    if (cacheContext.cacheHasChanged) {
      const data = cacheContext.tokenCache.serialize();
      fs.writeFileSync(CACHE_FILE_PATH, data);
    }
  },
};

const config = {
  auth: {
    clientId: process.env.CLIENT_ID,
    authority: `https://login.microsoftonline.com/${process.env.TENANT_ID}`,
  },
  cache: {
    cachePlugin: fileBasedCachePlugin,
  },
};

const pca = new PublicClientApplication(config);

async function getAccessToken() {
  const tokenCache = pca.getTokenCache();
  const accounts = await tokenCache.getAllAccounts();

  const request = {
    scopes: ["User.Read", "Files.ReadWrite"],
    account: accounts.length ? accounts[0] : null,
  };

  if (accounts.length > 0) {
    try {
      const silentResult = await pca.acquireTokenSilent(request);
      console.log("Acquired token silently.");
      return silentResult.accessToken;
    } catch (error) {
      console.log(
        "Silent token acquisition failed. Fallback to device code flow."
      );
    }
  } else {
    console.log("No accounts in cache. Proceeding with device code flow.");
  }

  const deviceCodeRequest = {
    ...request,
    deviceCodeCallback: (response) => {
      let responseMessage = response.message;
      console.log("\n--- DEVICE CODE FLOW ---");
      console.log({ responseMessage });
      console.log("------------------------\n");
    },
  };

  const tokenResponse = await pca.acquireTokenByDeviceCode(deviceCodeRequest);
  console.log("Token acquired via Device Code Flow.");
  return tokenResponse.accessToken;
}

export async function get_onedrive_folders() {
  try {
    const accessToken = await getAccessToken();
    console.log("Access token acquired.");

    const graphEndpoint =
      "https://graph.microsoft.com/v1.0/me/drive/root/children";
    const response = await fetch(graphEndpoint, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const data = await response.json();
    let formattedData = JSON.stringify(data, null, 2);
    console.log("\n--- OneDrive Root Children ---");
    console.log({ formattedData });
    console.log("--------------------------------\n");
  } catch (err) {
    console.error("An error occurred:", err);
  }
}

if (import.meta.url === process.argv[1]) {
  get_onedrive_folders();
}
