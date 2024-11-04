import axios from 'axios';
import { format } from 'date-fns';

class NFEService {
    constructor() {
        this.baseUrl = process.env.NFE_API_URL;
        this.token = process.env.NFE_API_TOKEN;
    }

    async generateNFE(sale, customer) {
        const nfeData = this.formatNFEData(sale, customer);
        
        try {
            // Em ambiente de desenvolvimento, simular a geração
            if (process.env.NODE_ENV === 'development') {
                return this.simulateNFE(nfeData);
            }

            // Em produção, integrar com API real da SEFAZ
            const response = await axios.post(`${this.baseUrl}/v1/nfe`, nfeData, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });

            return {
                success: true,
                nfeUrl: response.data.url,
                nfeKey: response.data.chave,
                nfeXml: response.data.xml
            };
        } catch (error) {
            console.error('Erro ao gerar NFE:', error);
            throw new Error('Falha ao gerar nota fiscal');
        }
    }

    simulateNFE(nfeData) {
        // Gerar chave de acesso simulada
        const chaveAcesso = this.generateSimulatedKey();
        
        // Criar XML simulado
        const xml = this.generateSimulatedXML(nfeData, chaveAcesso);
        
        // Simular URL de consulta
        const url = `http://nfe.fazenda.gov.br/portal/consultaRecaptcha.aspx?tipoConsulta=completa&chave=${chaveAcesso}`;

        return {
            success: true,
            nfeUrl: url,
            nfeKey: chaveAcesso,
            nfeXml: xml
        };
    }

    formatNFEData(sale, customer) {
        return {
            natureza_operacao: "Venda ao Consumidor",
            data_emissao: format(new Date(), "yyyy-MM-dd'T'HH:mm:ssxxx"),
            tipo_documento: "1", // NF-e
            finalidade_emissao: "1", // NF-e normal
            itens: sale.items.map((item, index) => ({
                numero_item: index + 1,
                codigo_produto: item._id,
                descricao: item.name,
                ncm: item.ncm || "00000000",
                cfop: "5102",
                unidade_comercial: item.unit,
                quantidade_comercial: item.quantidade,
                valor_unitario_comercial: item.price,
                valor_total_bruto: item.price * item.quantidade,
                icms: {
                    origem: "0",
                    situacao_tributaria: "102",
                    aliquota: "0.00"
                }
            })),
            cliente: {
                cpf: customer.cpf,
                nome_completo: customer.nome || "Consumidor Final",
                endereco: customer.endereco || {}
            },
            valor_total: sale.items.reduce((acc, item) => acc + (item.price * item.quantidade), 0),
            forma_pagamento: this.mapPaymentMethod(sale.paymentMethod)
        };
    }

    generateSimulatedKey() {
        const date = format(new Date(), 'yyMM');
        const random = Math.floor(Math.random() * 100000000000);
        return `35${date}${random}55000100000100`.padEnd(44, '0');
    }

    generateSimulatedXML(data, chaveAcesso) {
        // Gerar XML simplificado para simulação
        return `<?xml version="1.0" encoding="UTF-8"?>
            <nfeProc versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe">
                <NFe xmlns="http://www.portalfiscal.inf.br/nfe">
                    <infNFe versao="4.00" Id="NFe${chaveAcesso}">
                        <!-- Dados simulados da NF-e -->
                    </infNFe>
                </NFe>
            </nfeProc>`;
    }

    mapPaymentMethod(method) {
        const methods = {
            'dinheiro': '01',
            'cartao_credito': '03',
            'cartao_debito': '04',
            'pix': '17'
        };
        return methods[method] || '99';
    }
}

export default new NFEService(); 