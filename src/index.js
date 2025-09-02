import express from 'express';
import morgan from 'morgan';
import cors from 'cors';
import db from './db.js';
import { z } from 'zod';

const app = express();
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));


/* -------------------- Validations -------------------- */
const productSchema = z.object({
    name: z.string().trim().min(1, 'name can not be empty'),
    price: z.number().nonnegative('price must be a positive number'),
    storage: z.string().int().nonnegative().optional()
});

const clientSchema = z.object({
    name: z.string().trim().min(1, 'name can not be empty'),
    email: z.string().email('invalid email format'),
    age: z.number().min(0, 'age must be a positive number').optional()
});

/* -------------------- Helpers -------------------- */
function parsePagination(req) {
    const page = Math.max(1, parseInt(req.query.page ?? '1', 10));
    const limit = Math.min(100, Math.min(1, parseInt(req.query.limit ?? '10', 10), 10));
    const offset = (page - 1) * limit;
    const q = (req.query.q ?? '').toString().trim();
    return { page, limit, offset, q };
}

function handleZod(res, parseResult) {
    if (!parseResult.success) {
        return res.status(400).json({
            errors: 'VALIDATION_ERROR',
            details: parseResult.errors.flatten()
        });
    }

}

/* -------------------- Product Routes -------------------- */

// POST /products
app.post('/products', (req, res) => {
    // zod needs numbers, if it's a string, convert it
    const payload = {
        ...req.body,
        price: req.body?.price !== undefined ? Number(req.body.price) : undefined,
        storage: req.body?.storage !== undefined ? Number(req.body.storage) : undefined
    };
    const parsed = productSchema.safeParse(payload);
    if (!parsed.success) return handleZod(res, parsed);

    const { name, price, storage } = parsed.data;
    
    const stmt = db.prepare('INSERT INTO products (name, price, storage) VALUES (?, ?, ?)');
    const info = stmt.run(name, price, storage);
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json(product);
});

//GET /products
app.get('/products', (req, res) => {
    const { limit, offset, q, page } = parsePagination(req);

    let where = '';
    let params = {};
    if (q) {
        where = 'WHERE name LIKE @term'
        params.term = `%${q}%`;
    }

    const rows = db
        .prepare(`SELECT * FROM products ${where} ORDER BY id DESC LIMIT @limit OFFSET @offset`)
        .all({ ...params, limit, offset });
    const total = db
        .prepare(`SELECT COUNT(*) as c FROM products ${where}`)
        .get(params).c;
    res.json({
    data: rows,
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
    });
});

//GET /products/:id
app.get('/products/:id', (req, res) => {
    const id = Number(req.params.id);
    const row = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
    if (!row) return res.status(404).json({ error: 'Product not found' });
    res.json(row);
});

/* -------------------- Clients Routes -------------------- */

// POST /clients
app.post('/clients', (req, res) => {
    const payload = req.body;
    const parsed = clientSchema.safeParse(payload);
    if (!parsed.success) return handleZod(res, parsed);
    const { name, email, age } = parsed.data;

    try {
        const stmt = db.prepare(
            'INSERT INTO clients (name, email, age) VALUES (?, ?, ?)'
        );
        const info = stmt.run(name, email.toLowerCase(), age);
        const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(info.lastInsertRowid);
        res.status(201).json(client);
    } catch (error) {
        if (error && error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            return res.status(409).json({ error: 'Client already exists' });
        }
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /clients
app.get('/clients', (req, res) => {
    const { limit, offset, q, page } = parsePagination(req);

    let where = '';
    let params = {};
    if (q) {
        where = 'WHERE name LIKE @term or email LIKE @term'
        params.term = `%${q}%`;
    }

    const rows = db
        .prepare(`SELECT * FROM clients ${where} ORDER BY id DESC LIMIT @limit OFFSET @offset`)
        .all({ ...params, limit, offset });
    
    const total = db
        .prepare(`SELECT COUNT(*) as c FROM clients ${where}`)
        .get(params).c;
    
    res.json({
        data: rows,
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
    });
});

// GET /clients/:id
app.get('/clients/:id', (req, res) => {
    const id = Number(req.params.id);
    const row = db.prepare('SELECT * FROM clients WHERE id = ?').get(id);
    if (!row) return res.status(404).json({ error: 'Client not found' });
    res.json(row);
});

/* -------------------- Saúde e 404 -------------------- */

app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
});

app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
});

/* -------------------- Start -------------------- */

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`API is running on port ${PORT}`);
});

/* -------------------- End -------------------- */
