import os
import pandas as pd
import glob

path = './csv'
all_files = glob.glob(os.path.join(path, "*.csv"))

writer = pd.ExcelWriter('out.xlsx', engine='xlsxwriter')

err = []

for f in all_files:
  try:
    df = pd.read_csv(f)
    df.to_excel(writer, sheet_name=os.path.splitext(os.path.basename(f))[0], index=False)
    print(f'{f} is merged successfully')
  except:
    print(f'Error on file {f}: filename too long')
    err.append(f)
writer.save()
print('\n\nFiles with error: ')
print(*[x for x in err], sep="\n    ")