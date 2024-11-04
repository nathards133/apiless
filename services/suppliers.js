import dbConnect from '../lib/dbConnect.js';
import Supplier from '../models/Supplier.js';
import auth from '../lib/auth.js';

export default async function handler(req, res) {
  await dbConnect();
  const isAuthenticated = auth(req, res);
  if (!isAuthenticated) return;

  if (req.method === 'GET') {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const sortBy = req.query.sortBy || 'name';
      const sortOrder = req.query.sortOrder === 'desc' ? -1 : 1;
      const filterCity = req.query.filterCity || '';
      const searchTerm = req.query.search || '';

      const query = { userId: req.userId };

      if (filterCity) {
        query['address.city'] = { $regex: filterCity, $options: 'i' };
      }

      if (searchTerm) {
        query.$or = [
          { name: { $regex: searchTerm, $options: 'i' } },
          { 'suppliedProducts.name': { $regex: searchTerm, $options: 'i' } }
        ];
      }

      const sortOptions = {};
      sortOptions[sortBy] = sortOrder;

      const suppliers = await Supplier.find(query)
        .sort(sortOptions)
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('suppliedProducts')
        .lean();

      const total = await Supplier.countDocuments(query);

      return res.status(200).json({
        suppliers,
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalItems: total
      });
    } catch (error) {
      console.error('Erro ao buscar fornecedores:', error);
      return res.status(500).json({ message: 'Erro interno do servidor' });
    }
  } else if (req.method === 'POST') {
    try {
      const supplierData = { ...req.body, userId: req.userId };
      const supplier = new Supplier(supplierData);
      await supplier.save();
      return res.status(201).json(supplier);
    } catch (error) {
      console.error('Erro ao criar fornecedor:', error);
      return res.status(400).json({ message: error.message });
    }
  } else if (req.method === 'PUT') {
    try {
      const { id } = req.query;
      const updatedSupplier = await Supplier.findOneAndUpdate(
        { _id: id, userId: req.userId },
        req.body,
        { new: true, runValidators: true }
      );
      if (!updatedSupplier) {
        return res.status(404).json({ message: 'Fornecedor não encontrado' });
      }
      return res.json(updatedSupplier);
    } catch (error) {
      console.error('Erro ao atualizar fornecedor:', error);
      return res.status(400).json({ message: error.message });
    }
  } else if (req.method === 'DELETE') {
    try {
      const { id } = req.query;
      const deletedSupplier = await Supplier.findOneAndDelete({ _id: id, userId: req.userId });
      if (!deletedSupplier) {
        return res.status(404).json({ message: 'Fornecedor não encontrado' });
      }
      return res.json({ message: 'Fornecedor removido com sucesso' });
    } catch (error) {
      console.error('Erro ao excluir fornecedor:', error);
      return res.status(500).json({ message: error.message });
    }
  } else {
    res.status(405).json({ message: 'Método não permitido' });
  }
}
