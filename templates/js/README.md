# JS Component Templates

Reusable JS block/column templates. Scaffold copies these to page directories with parameters filled in.

## Usage

1. Copy a template to your page's `js/` directory
2. Replace `{{PARAM}}` placeholders with actual values
3. Reference in layout.yaml via `js_items` or `js_columns`

## Templates

| Template | Type | Description | Key Parameters |
|----------|------|-------------|----------------|
| `stats-filter.js` | JSItemModel | Status filter buttons with live SQL counts | COLLECTION, GROUP_FIELD |
| `kpi-card.js` | JSBlockModel | Single metric card with SQL | LABEL, COLOR, SQL |
| `status-tag.js` | JSColumnModel | Colored tag based on field value | FIELD, COLOR_MAP |
| `progress-bar.js` | JSColumnModel | Visual percentage bar | VALUE_FIELD, TOTAL_FIELD |
| `currency.js` | JSColumnModel | Formatted currency display | FIELD, SYMBOL, DECIMALS |

## Parameter Syntax

```
{{PARAM}}           → required, must be replaced
{{PARAM||default}}  → optional, uses default if not replaced
```

## Example: Adding a stats filter to a page

```yaml
# layout.yaml
blocks:
  - key: filterForm
    type: filterForm
    coll: nb_erp_products
    js_items:
      - key: stats
        file: ./js/stats_filter.js
        desc: Product Stats
```

```bash
# Copy template and fill params
cp templates/js/stats-filter.js pages/erp/products/js/stats_filter.js
# Edit: replace {{COLLECTION}} with nb_erp_products
```
