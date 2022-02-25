// @ts-nocheck
function myFunction() {
  const docId = 'GOOGLE DOC ID HERE'
  const doc = DocumentApp.openById(docId).getBody()

  const spreadsheetId = 'GOOGLE SHEETS ID HERE'
  const spreadsheet = SpreadsheetApp.openById(spreadsheetId)
  const sheets = spreadsheet.getSheets()


  const copyTable = doc.getTables()[0]

  // basic styling for tables 
  var style = {};
  style[DocumentApp.Attribute.HORIZONTAL_ALIGNMENT] = DocumentApp.HorizontalAlignment.RIGHT;
  style[DocumentApp.Attribute.FONT_FAMILY] = 'Times New Roman';
  style[DocumentApp.Attribute.FONT_SIZE] = 12;


  for(const sheet of sheets){
    // operation for each sheet
    const sheetName = sheet.getName()

    // get the first 30 columns, can change the values based on your situation
    const values = sheet.getRange('A1:D30').getValues()

    const table = doc.appendTable(copyTable.copy())

    const firstRow = table.getRow(0)
    firstRow.getCell(0).setText('Table Name')
    firstRow.getCell(1).setText(sheetName)

    
    values.forEach((value, index) => {
      if(!value[0]) return
      const rowTable = doc.appendTable([value.map(String)])
      table.appendTableRow(rowTable.getRow(0).copy())
      rowTable.removeFromParent()
   })

   // add styling to the table
    table.setAttributes(style)

    for(let i = 1; i < table.getNumRows(); i++){
      table.getRow(i).getCell(0).setBackgroundColor('#deebf6')
    }

    const firstRowStyle = {...style}
    for(let i = 0; i < 4; i++) 
      table.getRow(1).getCell(i).setBackgroundColor('#5b9bd5')


    const tableNameStyle = {...style}
    tableNameStyle[DocumentApp.Attribute.BOLD] = true
    const tableNameRow = table.getRow(0).setAttributes(tableNameStyle)
    tableNameRow.getCell(0).setBackgroundColor('#5b9bd5')

    // add page break
    doc.appendPageBreak();

    // log result
    Logger.log('Table added ' + sheet.getName())
  }
}