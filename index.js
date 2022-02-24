const PostgresSchema = require('pg-json-schema-export');
const _ = require('lodash')
const fs = require('fs')
const EventEmitter = require('events')
const XLSX = require('xlsx')
require('dotenv').config()


const connection = {
  user: process.env.DB_CONNECTION,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_DATABASE,
};

// ignore
const eventEmitter = new EventEmitter();

eventEmitter.on('myevent', schema => {
  console.log(schema)
})

async function getJSON(connection) {
  return await PostgresSchema.toJSON(connection, 'public')
} 

const wholeSchema = {}
const enums = new Set()
const wb = XLSX.utils.book_new()

// Tables to be excluded from the database
const omitTable = ['migrations', 'third_party_identities', 'notification', 'geography_columns', 'geometry_columns', 'spatial_ref_sys']

const schema = getJSON(connection)
  .then((schema) => {
    eventEmitter.emit('myevent', schema)
    
    for(let [key, value] of Object.entries(schema.tables)){
      if(omitTable.includes(key)) continue
      table2csv(value.columns, key)
      wholeSchema[key] = value.columns
    }
    XLSX.writeFile(wb, 'tables.xlsx')
    return schema
  })
  .then(schema => {
    for(let [key, value] of Object.entries(schema.constraints)){
      if(omitTable.includes(key)) continue
      for(let [constraintsKey, constraintsValues] of Object.entries(value))
        wholeSchema[key][constraintsKey].constraints = constraintsValues
       
    }
    try{
      fs.unlinkSync('./dbdiagram.txt')
    }catch(e){
      console.log('Creating text file for dbdiagram schema')
    }
    // writing dbdiagram schema text file ▸
    for(let [key, value] of Object.entries(wholeSchema)){
      fs.writeFileSync('./dbdiagram.txt', table2dbd(key, value), { flag: 'a+' }, err => {})
    }
    // writing enum to dbdiagram text file ▸
    fs.writeFileSync('./dbdiagram.txt', processFileEnum(enums), { flag: 'a+' }, err => {})
    return schema
  })
  .catch(err => {
    console.log(err)
  })

console.log(schema)

function table2csv (table, tableName) {
  console.log(`Processing ${tableName}`)
  const tableClone = { ...table}
  const data = [['Column Name', 'Data Type', 'Nullable', 'Default']]
  for(let [key, value] of Object.entries(tableClone)){
    // remove useless values
    const col = _.omit(value, ['table_schema', 'table_name', 'col_description'])

    // format column with enum
    if(col.column_default && col.column_default.startsWith('\'')){
      col.column_default = col.column_default.split('\'')[1]      
    }

    // format data type
    if(col.data_type === 'USER-DEFINED') col.data_type = 'enum'
    else if(col.data_type === 'character varying') col.data_type = 'varchar'
    else if(col.data_type === 'timestamp with time zone') col.data_type = 'timestamptz'
    else if(col.data_type === 'timestamp without time zone') col.data_type = 'timestamp'
    data.push([col.column_name, col.data_type, col.is_nullable, col.column_default])
  }
  const ws = XLSX.utils.aoa_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, tableName)
  console.log(`Table ${tableName} added to worksheet`)
}

function table2dbd (tableName, table) {
  let firstLine = 'Table ' + tableName + ' {'
  const columns = [firstLine]
  for(let [key, value] of Object.entries(table)){
    // process data type
    const dataType = value.data_type === 'USER-DEFINED' 
                     ? processEnum(value.column_default)
                     : value.data_type.includes('uuid')
                     ? 'uuid' 
                     : value.data_type.includes('time')
                     ? 'timestamp'
                     : value.data_type.includes('varying')
                     ? 'varchar'
                     :value.data_type
    
    // process constraints based on columns
    let constraints = []
    if(!value.is_nullable) constraints.push('not null')
    if(value.constraints){
      for(const constraint of value.constraints) {
        if (constraint.constraint_type === 'PRIMARY KEY') constraints.unshift('PK')
        else if (constraint.constraint_type === 'UNIQUE') constraints.push('unique')
        else if (constraint.constraint_type === 'FOREIGN KEY') constraints.push(processFK(key))
        else if (value.column_default && value.data_type !== 'USER-DEFINED') constraints.push(`default: ${processDefault(value.column_default)}`)
      }
    }
    const con = _.isEmpty(constraints) ? '' : `[${constraints.join(', ')}]` 
    const columnLine = `${key} ${dataType} ${con}`
    columns.push(columnLine)
  }
  return columns.join('\n\t') + '\n}\n\n'

}

function processEnum (data) {
  if (!data) return 'enum'
  let dataEnum= _.startCase(_.camelCase(data.split('::')[1])).replace(/ /g, '')
  dataEnum = dataEnum.includes('generalStatus') ? 'GeneralStatusEnum' : dataEnum
  enums.add(dataEnum)
  return dataEnum
}

function processFK (columnName){
  return "ref: > " + columnName.trim().split('_id')[0] + "s.id"
}

function processFileEnum(enums) {
  let str = ''
  for(const e of enums){
    str += `Enum ${e.includes('generalStatus') ? 'GeneralStatusEnum' : e} { \n\t placeholder\n}\n\n`
  }
  return str
}

function processDefault (data) {
  return Number(data) 
      ? data 
      : data.includes('uuid')
      ? "'uuid'"
      : `'${data}'`
}


var converter = require('pg-tables-to-jsonschema');
 
// converter({
//   pg: {
//     host: 'localhost',
//     port: 5432,
//     user: 'admin',
//     password: 'secret',
//     database: 'db_name',
//   },
//   input: {
//     schemas: ['public', 'stuff'],
//     exclude: ['not_this_table'],
//     include: []
//   },
//   output: {
//     additionalProperties: false,
//     baseUrl: 'http://api.localhost.com/schema/',
//     defaultDescription: 'Missing description',
//     indentSpaces: 2,
//     outDir: 'dist/schema',
//     unwrap: false
//   }
// });