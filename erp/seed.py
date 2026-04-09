"""Seed test data for Manufacturing ERP."""
from nb import NocoBase
nb = NocoBase()

def create(coll, records):
    for r in records:
        nb.s.post(f'{nb.base}/api/{coll}:create', json=r, timeout=30)
    print(f'  + {coll}: {len(records)} records')

create('erp_materials', [
    {"code":"M-001","name":"Q235 Carbon Steel Plate","category":"Raw Material","unit":"ton","spec":"3mm×1500mm","list_price":4500,"cost_price":3800,"stock_qty":120,"min_stock":50,"max_stock":500,"lead_time":7,"status":"Active"},
    {"code":"M-002","name":"304 Stainless Steel Pipe","category":"Raw Material","unit":"m","spec":"DN50×3mm","list_price":85,"cost_price":62,"stock_qty":3000,"min_stock":500,"max_stock":10000,"lead_time":10,"status":"Active"},
    {"code":"P-001","name":"ZDY Gearbox Assembly","category":"Finished","unit":"pcs","spec":"ZDY250-3.15","list_price":12800,"cost_price":8500,"stock_qty":35,"min_stock":10,"max_stock":100,"lead_time":21,"status":"Active"},
    {"code":"P-002","name":"Hydraulic Cylinder HG-100","category":"Finished","unit":"pcs","spec":"φ100×500","list_price":3200,"cost_price":2100,"stock_qty":2,"min_stock":20,"max_stock":80,"lead_time":14,"status":"Active"},
    {"code":"S-001","name":"6205 Deep Groove Bearing","category":"Auxiliary","unit":"pcs","spec":"25×52×15mm","list_price":45,"cost_price":28,"stock_qty":5000,"min_stock":1000,"max_stock":20000,"lead_time":5,"status":"Active"},
    {"code":"S-002","name":"O-Ring Seal Kit","category":"Auxiliary","unit":"set","spec":"φ20-80 Universal","list_price":120,"cost_price":65,"stock_qty":800,"min_stock":200,"max_stock":3000,"lead_time":3,"status":"Active"},
    {"code":"B-001","name":"Motor Housing Type A","category":"Semi-finished","unit":"pcs","spec":"YE2-132M","list_price":680,"cost_price":420,"stock_qty":150,"min_stock":30,"max_stock":300,"lead_time":5,"status":"Active"},
    {"code":"P-003","name":"New Drive Shaft","category":"Finished","unit":"pcs","spec":"φ80×1200","list_price":5600,"cost_price":3800,"stock_qty":0,"min_stock":5,"max_stock":50,"lead_time":28,"status":"In Development"},
    {"code":"M-003","name":"Cast Iron Flange DN150","category":"Semi-finished","unit":"pcs","spec":"PN16","list_price":280,"cost_price":160,"stock_qty":2,"min_stock":50,"max_stock":200,"lead_time":7,"status":"Discontinued"},
    {"code":"K-001","name":"Corrugated Box 640×480","category":"Packaging","unit":"pcs","spec":"5-Layer","list_price":8,"cost_price":5,"stock_qty":10000,"min_stock":2000,"max_stock":30000,"lead_time":2,"status":"Active"},
])

create('erp_customers', [
    {"code":"C-001","name":"Shanghai Heavy Machinery Co.","contact":"Zhang Wei","phone":"021-58001234","email":"zhang@shzg.com","level":"VIP","industry":"Manufacturing","payment_terms":"Net 30","credit_limit":500000,"tax_rate":13,"status":"Active"},
    {"code":"C-002","name":"Guangzhou Automation Equipment","contact":"Li Ming","phone":"020-87654321","email":"li@gznf.com","level":"A","industry":"Electronics","payment_terms":"Net 60","credit_limit":300000,"tax_rate":13,"status":"Active"},
    {"code":"C-003","name":"Zhejiang Precision Manufacturing","contact":"Wang Lei","phone":"0571-88001122","email":"wang@zjjm.com","level":"B","industry":"Automotive","payment_terms":"Net 30","credit_limit":200000,"tax_rate":13,"status":"Active"},
    {"code":"C-004","name":"Beijing Aerospace Components","contact":"Chen Hui","phone":"010-62001234","level":"VIP","industry":"Manufacturing","payment_terms":"Prepaid","credit_limit":1000000,"tax_rate":13,"status":"Active"},
    {"code":"C-005","name":"Chengdu Western Electromech","contact":"Liu Jie","phone":"028-85001234","level":"C","industry":"Energy","payment_terms":"Net 90","credit_limit":100000,"tax_rate":13,"status":"Suspended"},
])

create('erp_suppliers', [
    {"code":"V-001","name":"Baosteel Special Steel","contact":"Zhao Gang","phone":"021-26641234","category":"Raw Material","rating":"A-Excellent","payment_terms":"Net 30","delivery_score":95,"quality_score":98,"status":"Approved"},
    {"code":"V-002","name":"Taiyuan Steel Pipe Works","contact":"Sun Qiang","phone":"0351-40001234","category":"Raw Material","rating":"B-Good","payment_terms":"Net 60","delivery_score":85,"quality_score":90,"status":"Approved"},
    {"code":"V-003","name":"Luoyang Bearing Group","contact":"Zhou Chang","phone":"0379-64001234","category":"Components","rating":"A-Excellent","payment_terms":"Net 30","delivery_score":92,"quality_score":96,"status":"Approved"},
    {"code":"V-004","name":"Wuxi Sealing Co.","contact":"Wu Bin","phone":"0510-85001234","category":"Components","rating":"C-Acceptable","payment_terms":"Prepaid","delivery_score":70,"quality_score":75,"status":"Trial"},
    {"code":"V-005","name":"Yongkang Mold Works","contact":"Ma Lin","phone":"0579-83001234","category":"Equipment","rating":"D-Needs Improvement","payment_terms":"Prepaid","delivery_score":55,"quality_score":60,"status":"Suspended"},
])

create('erp_purchase_orders', [
    {"po_no":"PO-2026-001","supplier_name":"Baosteel Special Steel","total_amount":540000,"tax_amount":70200,"status":"Received","priority":"Normal","order_date":"2026-03-01","expected_date":"2026-03-15","actual_date":"2026-03-14","buyer":"Wang Caigou"},
    {"po_no":"PO-2026-002","supplier_name":"Luoyang Bearing Group","total_amount":45000,"tax_amount":5850,"status":"Approved","priority":"High","order_date":"2026-03-20","expected_date":"2026-04-12","buyer":"Wang Caigou"},
    {"po_no":"PO-2026-003","supplier_name":"Taiyuan Steel Pipe Works","total_amount":186000,"tax_amount":24180,"status":"Pending Approval","priority":"Urgent","order_date":"2026-04-01","expected_date":"2026-04-10","buyer":"Li Caigou"},
    {"po_no":"PO-2026-004","supplier_name":"Wuxi Sealing Co.","total_amount":26000,"tax_amount":3380,"status":"Draft","priority":"Low","order_date":"2026-04-08","buyer":"Wang Caigou"},
    {"po_no":"PO-2026-005","supplier_name":"Baosteel Special Steel","total_amount":320000,"tax_amount":41600,"status":"Partial Receipt","priority":"Normal","order_date":"2026-03-25","expected_date":"2026-04-15","buyer":"Li Caigou"},
])

create('erp_sales_orders', [
    {"so_no":"SO-2026-001","customer_name":"Shanghai Heavy Machinery Co.","total_amount":256000,"tax_amount":33280,"status":"Shipped","priority":"High","order_date":"2026-03-05","delivery_date":"2026-03-20","shipped_date":"2026-03-18","sales_rep":"Zhang Sales"},
    {"so_no":"SO-2026-002","customer_name":"Beijing Aerospace Components","total_amount":640000,"tax_amount":83200,"status":"In Production","priority":"Urgent","order_date":"2026-03-15","delivery_date":"2026-04-30","sales_rep":"Zhang Sales"},
    {"so_no":"SO-2026-003","customer_name":"Guangzhou Automation Equipment","total_amount":128000,"tax_amount":16640,"status":"Confirmed","priority":"Normal","order_date":"2026-04-01","delivery_date":"2026-04-25","sales_rep":"Li Sales"},
    {"so_no":"SO-2026-004","customer_name":"Zhejiang Precision Manufacturing","total_amount":38400,"tax_amount":4992,"status":"Draft","priority":"Low","order_date":"2026-04-08","sales_rep":"Li Sales"},
    {"so_no":"SO-2026-005","customer_name":"Chengdu Western Electromech","total_amount":96000,"tax_amount":12480,"status":"Delivered","priority":"Normal","order_date":"2026-02-20","delivery_date":"2026-03-10","shipped_date":"2026-03-08","sales_rep":"Zhang Sales"},
])

create('erp_work_orders', [
    {"wo_no":"WO-2026-001","product_name":"ZDY Gearbox Assembly","planned_qty":50,"completed_qty":35,"defect_qty":2,"status":"In Progress","priority":"Urgent","planned_start":"2026-03-20","planned_end":"2026-04-15","actual_start":"2026-03-22","workshop":"Workshop A","so_no":"SO-2026-002"},
    {"wo_no":"WO-2026-002","product_name":"Hydraulic Cylinder HG-100","planned_qty":100,"completed_qty":100,"defect_qty":3,"status":"Completed","priority":"Normal","planned_start":"2026-03-01","planned_end":"2026-03-25","actual_start":"2026-03-01","actual_end":"2026-03-23","workshop":"Workshop B","so_no":"SO-2026-001"},
    {"wo_no":"WO-2026-003","product_name":"Motor Housing Type A","planned_qty":200,"completed_qty":80,"defect_qty":5,"status":"On Hold","priority":"High","planned_start":"2026-04-01","planned_end":"2026-04-20","actual_start":"2026-04-02","workshop":"Workshop A"},
    {"wo_no":"WO-2026-004","product_name":"ZDY Gearbox Assembly","planned_qty":30,"completed_qty":0,"defect_qty":0,"status":"Scheduled","priority":"Normal","planned_start":"2026-04-15","planned_end":"2026-05-05","workshop":"Workshop A","so_no":"SO-2026-003"},
])

create('erp_inventory', [
    {"txn_no":"INV-001","product_name":"Q235 Carbon Steel Plate","product_code":"M-001","txn_type":"Purchase Receipt","qty":50,"warehouse":"Raw Material","ref_no":"PO-2026-001","operator":"Warehouse A"},
    {"txn_no":"INV-002","product_name":"Q235 Carbon Steel Plate","product_code":"M-001","txn_type":"Production Issue","qty":20,"warehouse":"Raw Material","ref_no":"WO-2026-001","operator":"Shop Floor"},
    {"txn_no":"INV-003","product_name":"ZDY Gearbox Assembly","product_code":"P-001","txn_type":"Production Receipt","qty":15,"warehouse":"Finished Goods","ref_no":"WO-2026-002","operator":"Warehouse B"},
    {"txn_no":"INV-004","product_name":"Hydraulic Cylinder HG-100","product_code":"P-002","txn_type":"Sales Issue","qty":50,"warehouse":"Finished Goods","ref_no":"SO-2026-001","operator":"Warehouse A"},
    {"txn_no":"INV-005","product_name":"6205 Deep Groove Bearing","product_code":"S-001","txn_type":"Purchase Receipt","qty":2000,"warehouse":"Raw Material","ref_no":"PO-2026-002","operator":"Warehouse A"},
    {"txn_no":"INV-006","product_name":"Corrugated Box 640×480","product_code":"K-001","txn_type":"Transfer","qty":500,"warehouse":"Finished Goods","ref_no":"","operator":"Warehouse B"},
])

create('erp_quality', [
    {"qc_no":"QC-001","product_name":"Q235 Carbon Steel Plate","qc_type":"Incoming","batch_no":"B2026-0301","sample_qty":10,"pass_qty":10,"fail_qty":0,"result":"Pass","ref_no":"PO-2026-001","inspector":"Inspector A"},
    {"qc_no":"QC-002","product_name":"304 Stainless Steel Pipe","qc_type":"Incoming","batch_no":"B2026-0315","sample_qty":20,"pass_qty":18,"fail_qty":2,"result":"Conditional Accept","ref_no":"PO-2026-003","inspector":"Inspector A"},
    {"qc_no":"QC-003","product_name":"ZDY Gearbox Assembly","qc_type":"Final","batch_no":"B2026-0401","sample_qty":10,"pass_qty":10,"fail_qty":0,"result":"Pass","ref_no":"WO-2026-002","inspector":"Inspector B"},
    {"qc_no":"QC-004","product_name":"Motor Housing Type A","qc_type":"In-Process","batch_no":"B2026-0405","sample_qty":15,"pass_qty":12,"fail_qty":3,"result":"Fail","ref_no":"WO-2026-003","inspector":"Inspector B","remark":"Casting defects: 3 units with porosity exceeding spec"},
    {"qc_no":"QC-005","product_name":"Hydraulic Cylinder HG-100","qc_type":"Outgoing","batch_no":"B2026-0410","sample_qty":5,"pass_qty":5,"fail_qty":0,"result":"Pass","ref_no":"SO-2026-001","inspector":"Inspector A"},
])

print(f'\nTotal: 45 records seeded')
