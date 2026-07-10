import { patternFromExample, extractRolls } from '../src/lib/parseTopSheet';
import { rollLines } from '../src/lib/rollFormat';

// 1. custom roll pattern from example
const ex = '232035-12-0026';
console.log('pattern:', patternFromExample(ex));
const messy = 'foo AB12 232042-11-0010, 232042-11-0011 bar 12/09/2024 232035-12-0004';
console.log('custom extract:', extractRolls(messy, ex));
// pattern with letters
console.log('alpha pattern:', patternFromExample('BA21-0042'));
console.log('alpha extract:', extractRolls('rolls: BA21-0042 BX99-1234 nope 12345', 'BA21-0042'));

// 2. grouped display: prefix on its own line
const rolls = ['232042-11-0010','232042-11-0011','232042-11-0014','232042-11-0015','232042-11-0017','232042-11-0019','232042-11-0025','232035-12-0023'];
console.log('grouped lines:', JSON.stringify(rollLines(rolls, 'grouped', 48), null, 1));
