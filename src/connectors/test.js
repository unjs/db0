import { createDatabase } from '../../dist/index.cjs';
import mssql from '../../connectors/mssql.cjs';

const db = createDatabase(mssql({
  server: 'localhost',
  authentication: {
    type: 'default',
    options: {
      userName: 'sa',
      password: '3dg3Y0urB3ts',
    },
  },
  options: {
    database: 'test_db',
    port: Number.parseInt(process.env.MSSQL_PORT || '32768', 10),
    trustServerCertificate: true,
    encrypt: false,
  },
}));

const id = 2;

console.log(await db.sql`SELECT * from [test_db].[test_schema].[test_table3] where id = ${id}`);
console.log('exec', await db.exec(`SELECT * from [test_db].[test_schema].[test_table3] where id = ${id}`));
// // console.log(db.dialect)
console.log('all', await db.prepare(`SELECT * from [test_db].[test_schema].[test_table3] where id = ${id}`).all());
console.log('run', await db.prepare(`SELECT * from [test_db].[test_schema].[test_table3] where id = ${id}`).run());
console.log('get', await db.prepare(`SELECT * from [test_db].[test_schema].[test_table3] where id = ${id}`).get());
// console.log('run', await db.prepare(`CREATE TABLE users2 (
//     [id] NVARCHAR(4) PRIMARY KEY,
//     [firstName] NVARCHAR(255),
//     [lastName] NVARCHAR(255),
//     [email] NVARCHAR(255)
// )`).run());


