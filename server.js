import express from "express";
import cors from "cors";
import { ethers } from "ethers";
import axios from "axios";

const app = express();
app.use(cors());

const supportedChains = {
  ethereum: {
    rpcUrl: "https://mainnet.infura.io/v3/47d22dd525d84011a6a8abcd04429033",
    coinId: "ethereum",
  },
  polygon: {
    rpcUrl: "https://polygon-rpc.com/",
    coinId: "matic-network",
  },
};

console.log("Servidor iniciado...");

app.get("/api/stats/:chainName", async (req, res) => {
  const { chainName } = req.params;
  const chainConfig = supportedChains[chainName];

  if (!chainConfig) {
    return res.status(400).json({ error: `Rede não suportada: ${chainName}` });
  }

  console.log(`Buscando dados para a rede: ${chainName}`);

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

const PORT = 3000;
app.listen(PORT, () => {
  console.log(
    `Servidor rodando na porta ${PORT}. Endpoints dinâmicos estão ativos.`
  );
});
