const PostgresSchema = require('pg-json-schema-export');
const _ = require('lodash')
const fs = require('fs')
const createCsvWriter = require('csv-writer').createObjectCsvWriter
const EventEmitter = require('events')

const connection = {
user: process.env.DB_CONNECTION,
password: process.env.DB_PASSWORD,
host: process.env.DB_HOST,
port: process.env.DB_PORT,
database: process.env.DB_DATABASE,
};

function getJSON(connection) {
  return PostgresSchema.toJSON(connection, 'public')
} 

const wholeSchema = {}
const enums = new Set()

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
    return schema
  })
  .then(schema => {
    for(let [key, value] of Object.entries(schema.constraints)){
      if(omitTable.includes(key)) continue
      for(let [constraintsKey, constraintsValues] of Object.entries(value))
        wholeSchema[key][constraintsKey].constraints = constraintsValues
       
    }
    // writing dbdiagram schema text file ▸
    for(let [key, value] of Object.entries(wholeSchema)){
      fs.writeFileSync('./dbdiagram.txt', table2dbd(key, value), { flag: 'a+' }, err => {})
    }
    // writing enum to dbdiagram text file ▸
    fs.writeFileSync('./dbdiagram.txt', processFileEnum(enums), { flag: 'a+' }, err => {})
    return schema
  })
  .catch(err => console.log(err))


function table2csv (table, tableName) {
  console.log(`Processing ${tableName}`)
  const tableClone = { ...table}

  // csv output configuration
  const csvWriter = createCsvWriter({
    path: `csv/${tableName}.csv`,
    //csv headers
    header: [
      {id: 'column_name', title: 'Column Name'},
      {id: 'data_type', title: 'Data Type'},
      {id: 'is_nullable', title: 'Nullable'},
      {id: 'column_default', title: 'Default Value'},
    ]
  });
  const data = []
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
    data.push(col)
  }

  // writing to csv
  csvWriter
  .writeRecords(data)
  .then(()=> console.log(`The CSV file ${tableName} is created successfully`));
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

// ignore
const eventEmitter = new EventEmitter();

eventEmitter.on('myevent', schema => {
  console.log(schema)
})