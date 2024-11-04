import dbConnect from '../lib/dbConnect.js';
import Product from '../models/Product.js';
import auth from '../lib/auth.js';
import xlsx from 'xlsx';

export default async function handler(req, res) {
  await dbConnect();
  const isAuthenticated = auth(req, res);
  if (!isAuthenticated) return;

  if (req.method === 'POST') {
    // Lógica para createProduct
    try {
      const { name, price, quantity, barcode, unit, expirationDate } = req.body;
      const product = new Product({
        name,
        price,
        quantity,
        barcode,
        unit,
        userId: req.userId 
      });

      if (expirationDate) {
        product.expirationDate = expirationDate;
      }

      await product.save();
      return res.status(201).json(product);
    } catch (error) {
      return res.status(400).json({ message: error.message });
    }
  } else if (req.method === 'GET') {
    // Lógica para getProducts com filtros
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const showArchived = req.query.showArchived === 'true';
      const sortBy = req.query.sortBy || 'name';
      const sortOrder = req.query.sortOrder === 'desc' ? -1 : 1;
      const filterUnit = req.query.filterUnit || '';
      const searchTerm = req.query.search || '';

      const query = { userId: req.userId };

      // Aplicar filtro de arquivado
      if (!showArchived) {
        query.archived = { $ne: true };
      }

      // Aplicar filtro de unidade
      if (filterUnit) {
        query.unit = filterUnit;
      }

      // Aplicar filtro de busca
      if (searchTerm) {
        query.name = { $regex: searchTerm, $options: 'i' };
      }

      const sortOptions = {};
      sortOptions[sortBy] = sortOrder;

      const products = await Product.find(query)
        .sort(sortOptions)
        .skip((page - 1) * limit)
        .limit(limit)
        .lean();

      const total = await Product.countDocuments(query);

      return res.json({
        products,
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalItems: total
      });
    } catch (error) {
      console.error('Erro ao buscar produtos:', error);
      if (!res.headersSent) {
        return res.status(500).json({ message: 'Erro interno do servidor' });
      }
    }
  } else if (req.method === 'DELETE') {
    // Lógica para deleteProduct
    try {
      const product = await Product.findOneAndDelete({ _id: req.query.id, userId: req.userId });
      if (!product) return res.status(404).json({ message: 'Produto não encontrado' });
      return res.json({ message: 'Produto removido com sucesso' });
    } catch (error) {
      return res.status(500).json({ message: error.message });
    }
  } else if (req.method === 'PATCH') {
    // Nova lógica para arquivar/desarquivar produto
    try {
      const { id } = req.query;
      const { action } = req.body;

      if (![true, false].includes(action)) {
        return res.status(400).json({ message: 'Ação inválida' });
      }

      const product = await Product.findOne({ _id: id, userId: req.userId });
      if (!product) {
        return res.status(404).json({ message: 'Produto não encontrado' });
      }

      product.archived = action === true;
      await product.save();

      return res.json({ message: `Produto ${action === true ? 'arquivado' : 'desarquivado'} com sucesso`, product });
    } catch (error) {
      console.error('Erro ao atualizar produto:', error);
      if (!res.headersSent) {
        return res.status(500).json({ message: 'Erro ao atualizar produto', error: error.message });
      }
    }
  } else if (req.method === 'PUT') {
    try {
      const { id } = req.query;
      const updates = req.body;

      // Verifica se a quantidade está sendo atualizada e se é não-negativa
      if ('quantity' in updates && updates.quantity < 0) {
        return res.status(400).json({ message: 'A quantidade não pode ser negativa' });
      }

      const product = await Product.findOneAndUpdate(
        { _id: updates._id, userId: req.userId },
        { $set: updates },
        { new: true, runValidators: true }
      );

      if (!product) {
        return res.status(404).json({ message: 'Produto não encontrado' });
      }

      console.log('Produto atualizado:', product);
      return res.status(200).json(product);
    } catch (error) {
      console.error('Erro ao atualizar produto:', error);
      if (!res.headersSent) { 
        return res.status(400).json({ message: error.message });
      }
    }
  } else {
    return res.status(405).json({ message: 'Método não permitido' });
  }
}
