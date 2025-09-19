import express from "express";
import cors from "cors";
import { ethers } from "ethers";
import axios from "axios";
import "dotenv/config";

const app = express();
app.use(cors());

const supportedChains = {
  ethereum: {
    rpcUrl: process.env.INFURA_API_KEY,
    coinId: "ethereum",
  },
  polygon: {
    rpcUrl: "https://polygon-rpc.com/",
    coinId: "matic-network",
  },
};

// ABI (Interface) Mínima para interagir com qualquer contrato ERC-20
const erc20Abi = [
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
];

// Lista de endereços de tokens populares para cada rede
const tokenAddresses = {
  ethereum: [
    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
    "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // USDC
    "0x6B175474E89094C44Da98b954EedeAC495271d0F", // DAI
    "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984", // UNI
  ],
  polygon: [
    "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270", // WMATIC
    "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174", // USDC (Polygon)
    "0xc2132D05D31c914a87C6611C10748AEb04B58e8F", // USDT (Polygon)
    "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063", // DAI (Polygon)
  ],
};

console.log("Servidor iniciado...");

// Rota para buscar os dados vitais da rede
app.get("/api/stats/:chainName", async (req, res) => {
  const { chainName } = req.params;
  const chainConfig = supportedChains[chainName];

  if (!chainConfig) {
    return res.status(400).json({ error: `Rede não suportada: ${chainName}` });
  }

  try {
    const provider = new ethers.JsonRpcProvider(chainConfig.rpcUrl);

    const [latestBlock, feeData, coingeckoResponse] = await Promise.all([
      provider.getBlock("latest"),
      provider.getFeeData(),
      axios.get(
        `https://api.coingecko.com/api/v3/simple/price?ids=${chainConfig.coinId}&vs_currencies=usd`
      ),
    ]);

    const coinPrice = coingeckoResponse.data[chainConfig.coinId].usd;

    const stats = {
      blockNumber: latestBlock.number.toString(),
      timestamp: latestBlock.timestamp,
      transactionCount: latestBlock.transactions.length,
      gasPrice: {
        slow: parseFloat(ethers.formatUnits(feeData.gasPrice, "gwei")).toFixed(
          2
        ),
        average: parseFloat(
          ethers.formatUnits(feeData.maxFeePerGas, "gwei")
        ).toFixed(2),
        fast: parseFloat(
          ethers.formatUnits(feeData.maxPriorityFeePerGas, "gwei")
        ).toFixed(2),
      },
      ethPrice: coinPrice.toString(),
    };

    res.json(stats);
  } catch (error) {
    console.error(`Erro ao buscar dados para a rede ${chainName}:`, error);
    res.status(500).json({
      error: `Falha ao buscar dados da blockchain para a rede ${chainName}.`,
    });
  }
});

// Rota para buscar saldos de tokens
app.get("/api/balances/:chainName/:walletAddress", async (req, res) => {
  const { chainName, walletAddress } = req.params;
  const chainConfig = supportedChains[chainName];

  if (!chainConfig || !ethers.isAddress(walletAddress)) {
    return res.status(400).json({ error: "Rede ou endereço inválido." });
  }

  try {
    const provider = new ethers.JsonRpcProvider(chainConfig.rpcUrl);
    const tokensToCheck = tokenAddresses[chainName] || [];

    const searchedSymbols = [];

    const balancePromises = tokensToCheck.map(async (tokenAddress) => {
      try {
        const contract = new ethers.Contract(tokenAddress, erc20Abi, provider);
        const [balance, symbol, decimals] = await Promise.all([
          contract.balanceOf(walletAddress),
          contract.symbol(),
          contract.decimals(),
        ]);

        searchedSymbols.push(symbol);

        if (balance > 0) {
          return {
            symbol,
            balance: ethers.formatUnits(balance, decimals),
          };
        }
        return null;
      } catch (e) {
        console.error(`Falha ao verificar o token ${tokenAddress}:`, e.message);
        return null;
      }
    });

    const foundBalances = (await Promise.all(balancePromises)).filter(
      (b) => b !== null
    );

    res.json({
      found: foundBalances,
      searched: searchedSymbols,
    });
  } catch (error) {
    console.error(
      `Erro ao buscar balanços para ${walletAddress} na rede ${chainName}:`,
      error
    );
    res.status(500).json({ error: "Falha ao buscar balanços dos tokens." });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}.`);
});
