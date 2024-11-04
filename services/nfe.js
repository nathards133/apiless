import dbConnect from '../lib/dbConnect.js';
import Sale from '../models/Sale.js';
import User from '../models/User.js';
import auth from '../lib/auth.js';
import { certificateManager } from '../config/certificates.js';
import { uploadNFe } from './storage.js';

export default async function handler(req, res) {
  await dbConnect();
  const isAuthenticated = auth(req, res);
  if (!isAuthenticated) return;

  if (req.method === 'POST') {
    try {
      const { saleId, customerCpf, customerName } = req.body;
      
      // Buscar a venda e dados do emitente
      const [sale, user] = await Promise.all([
        Sale.findOne({ _id: saleId, userId: req.userId }).populate('items.product'),
        User.findById(req.userId)
      ]);

      if (!sale) {
        return res.status(404).json({ message: 'Venda não encontrada' });
      }

      if (!user.hasCertificate) {
        return res.status(400).json({ 
          message: 'Certificado digital não configurado' 
        });
      }

      // Recupera o certificado do usuário
      const certInfo = await certificateManager.getCertificate(req.userId);

      // Configuração do cliente NFe com o certificado
      const nfeClient = new NFEClient({
        cert: certInfo.cert,
        password: certInfo.password,
        ambiente: user.nfeConfig.ambiente,
        serie: user.nfeConfig.serie
      });

      // Atualizar venda com dados do cliente
      sale.customerCpf = customerCpf;
      sale.customerName = customerName || 'Consumidor Final';
      await sale.save();

      // Preparar dados da NFe
      const nfeData = {
        natureza_operacao: 'Venda ao Consumidor Final',
        tipo_documento: '1', // NFe
        finalidade_emissao: '1', // Normal
        presenca_comprador: '1', // Presencial
        
        emitente: {
          cnpj: user.cnpj,
          nome: user.company,
          inscricao_estadual: user.stateRegistration,
          endereco: {
            uf: user.address.state,
            municipio: user.address.city,
            logradouro: user.address.street,
            numero: user.address.number,
            bairro: user.address.neighborhood,
            cep: user.address.zipCode
          }
        },

        destinatario: {
          cpf: customerCpf,
          nome: customerName || 'Consumidor Final',
          consumidor_final: '1',
          contribuinte: '9' // Não Contribuinte
        },

        itens: sale.items.map((item, index) => ({
          numero_item: index + 1,
          codigo: item.product._id.toString(),
          descricao: item.name,
          ncm: '21069090', // Código genérico para varejo
          cfop: '5102', // Venda de Mercadoria
          unidade_comercial: item.product.unit,
          quantidade_comercial: item.quantity,
          valor_unitario_comercial: item.price,
          valor_produtos: item.quantity * item.price,
          icms: {
            situacao_tributaria: '102', // Simples Nacional
            origem: '0' // Nacional
          }
        })),

        valor_total: sale.totalValue,
        forma_pagamento: mapPaymentMethod(sale.paymentMethod)
      };

      // Aqui você deve integrar com seu provedor de emissão de NFe
      // const nfeResponse = await emitirNFe(nfeData);
      
      // Simular resposta de sucesso
      const mockNfeResponse = {
        success: true,
        nfeNumber: `${Date.now()}`,
        nfeKey: `35${Date.now()}55`
      };

      if (mockNfeResponse.success) {
        try {
          // Simula o PDF da NFe (em produção, você receberá do provedor)
          const nfePdfBuffer = Buffer.from('NFe simulada');
          const filename = `${mockNfeResponse.nfeKey}.pdf`;
          
          const nfeUrl = await uploadNFe(nfePdfBuffer, filename);
          
          sale.nfeStatus = 'issued';
          sale.nfeNumber = mockNfeResponse.nfeNumber;
          sale.nfeKey = mockNfeResponse.nfeKey;
          sale.nfeUrl = nfeUrl;
          await sale.save();

          return res.json({
            message: 'NFe emitida com sucesso',
            nfeNumber: mockNfeResponse.nfeNumber,
            nfeKey: mockNfeResponse.nfeKey,
            nfeUrl
          });
        } catch (uploadError) {
          console.error('Erro ao fazer upload da NFe:', uploadError);
          throw uploadError;
        }
      }

      throw new Error('Falha ao emitir NFe');
    } catch (error) {
      console.error('Erro ao emitir NFe:', error);
      return res.status(500).json({ message: 'Erro ao emitir NFe' });
    }
  }
}

function mapPaymentMethod(method) {
  const paymentMap = {
    'dinheiro': '01',
    'cartao_credito': '03',
    'cartao_debito': '04',
    'pix': '17'
  };
  return paymentMap[method] || '99';
}
