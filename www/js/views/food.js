// Food section: Today, Favourites, Water, Vitamins.
import { segmented } from '../ui.js';
import { loadTargets } from './food-common.js';
import { renderToday } from './food-today.js';
import { renderFavs } from './food-favs.js';
import { renderWater } from './food-water.js';
import { renderVitamins } from './food-vitamins.js';

export async function render(root, ctx) {
  ctx.setTitle('Food');
  const tab = ['favs', 'water', 'vitamins'].includes(ctx.path[0]) ? ctx.path[0] : '';
  root.append(segmented([{ value: '', label: 'Today' }, { value: 'favs', label: 'Favourites' }, { value: 'water', label: 'Water' }, { value: 'vitamins', label: 'Vitamins' }],
    tab, v => ctx.go(v ? '#/food/' + v : '#/food')));
  const info = await loadTargets();
  if (tab === 'favs') await renderFavs(root, ctx, info);
  else if (tab === 'water') await renderWater(root, ctx, info);
  else if (tab === 'vitamins') await renderVitamins(root, ctx, info);
  else await renderToday(root, ctx, info);
}
