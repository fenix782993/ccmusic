import os,sys
from pathlib import Path
import uvicorn
BASE_DIR=Path(__file__).resolve().parent.parent
os.chdir(BASE_DIR)
if str(BASE_DIR) not in sys.path: sys.path.insert(0,str(BASE_DIR))
if __name__=='__main__':
    uvicorn.run('backend.server:app',host='0.0.0.0',port=int(os.getenv('PORT','8000')),proxy_headers=True,forwarded_allow_ips='*')
