// server.js VERSÃO COMPLETA E CORRETA

import express from 'express';
import cors from 'cors';
import { ethers } from 'ethers';
import axios from 'axios'; // Importa o axios para buscar o preço do ETH

const app = express();
app.use(cors());

// Sua conexão com a Ethereum
const provider = new ethers.JsonRpcProvider("https://mainnet.infura.io/v3/47d22dd525d84011a6a8abcd04429033");

console.log("Servidor iniciado, conectando à rede Ethereum...");

// A ROTA /api/stats QUE ESTAVA FALTANDO
app.get('/api/stats', async (req, res) => {
  try {
    // 1. Busca todos os dados da blockchain e da API de preço
    const [blockNumber, feeData, coingeckoResponse] = await Promise.all([
      provider.getBlockNumber(),
      provider.getFeeData(),
      axios.get('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd')
    ]);

    // 2. Extrai o preço do ETH da resposta
    const ethPrice = coingeckoResponse.data.ethereum.usd;

    // 3. Monta o objeto de resposta no formato exato que o React precisa
    const stats = {
      blockNumber: blockNumber.toString(),
      gasPrice: {
        slow: parseFloat(ethers.formatUnits(feeData.gasPrice, 'gwei')).toFixed(2),
        average: parseFloat(ethers.formatUnits(feeData.maxFeePerGas, 'gwei')).toFixed(2),
        fast: parseFloat(ethers.formatUnits(feeData.maxPriorityFeePerGas, 'gwei')).toFixed(2)
      },
      ethPrice: ethPrice.toString()
    };

    // 4. Envia o objeto JSON completo
    res.json(stats);
    
  } catch (error) {
    console.error("Erro ao buscar dados on-chain:", error);
    res.status(500).json({ error: 'Falha ao buscar dados da blockchain.' });
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}. O endpoint /api/stats está ativo.`);
});