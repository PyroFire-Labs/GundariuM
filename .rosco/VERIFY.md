# Rosco verification recipes

Inspect a command and its package script before running it. Run only the checks relevant to the changed boundary. Existing results are historical until repeated.

## Brain files

```sh
python3 - <<'PY'
from pathlib import Path
import json, re

root = Path('.rosco')
schema = json.loads((root / 'receipts/receipt.schema.json').read_text())

def validate(value, rule, path='$'):
    if 'const' in rule and value != rule['const']:
        raise ValueError(f'{path}: expected {rule["const"]!r}')
    if 'enum' in rule and value not in rule['enum']:
        raise ValueError(f'{path}: value {value!r} is not allowed')
    if rule.get('type') == 'string':
        if not isinstance(value, str): raise ValueError(f'{path}: expected string')
        if len(value) < rule.get('minLength', 0): raise ValueError(f'{path}: too short')
    elif rule.get('type') == 'array':
        if not isinstance(value, list): raise ValueError(f'{path}: expected array')
        for index, item in enumerate(value): validate(item, rule['items'], f'{path}[{index}]')
    elif rule.get('type') == 'object':
        if not isinstance(value, dict): raise ValueError(f'{path}: expected object')
        for key in rule.get('required', []):
            if key not in value: raise ValueError(f'{path}: missing {key}')
        allowed = set(rule.get('properties', {}))
        if rule.get('additionalProperties') is False and set(value) - allowed:
            raise ValueError(f'{path}: unexpected {sorted(set(value) - allowed)}')
        for key, item in value.items():
            if key in rule.get('properties', {}): validate(item, rule['properties'][key], f'{path}.{key}')

for receipt in (root / 'receipts').glob('*.json'):
    if receipt.name != 'receipt.schema.json':
        validate(json.loads(receipt.read_text()), schema, receipt.name)

missing = []
for markdown in root.rglob('*.md'):
    for target in re.findall(r'\]\(([^)#]+)', markdown.read_text()):
        if target.startswith(('http://', 'https://', '#')):
            continue
        if not (markdown.parent / target).resolve().exists():
            missing.append(f'{markdown}: {target}')
if missing:
    raise SystemExit('\n'.join(missing))
print('Rosco receipts validate; local Markdown links resolve')
PY
```

## Application and worker commands

These are available recipes, not evidence of a passing result. They may expose unrelated pre-existing failures in this dirty checkout.

```sh
npm run lint
npx tsc --noEmit
(cd worker && npm run typecheck)
(cd worker-battle-trappers && npm run check && npm run lint)
(cd contracts && forge test)
```

Do not run deployments, migrations, wallet actions, live Spore examples, miners, or credential-bearing commands as verification.
