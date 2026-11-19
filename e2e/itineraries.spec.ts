import { type Page, type Route } from '@playwright/test';
import { expect, test } from './fixtures';
import { expectNoAxeViolations, json, mockApi, PODIUM, SEARCH_URL } from './podiumMocks';

test.use({ locale: 'es-PE' });

type SavedItinerary = ReturnType<typeof toItinerary>;

/** Como lo guarda el backend: sin alias (`from_iata` / `to_iata`) y con perfil, pesos y fecha. */
function toItinerary(offerId: string, index: number) {
  const offer = PODIUM.podium.find((item) => item.offer_id === offerId)!;
  return {
    id: `00000000-0000-4000-8000-00000000000${index}`,
    name: 'LIM → MAD · 2026-12-10',
    trip_type: 'ONE_WAY',
    origin: 'LIM',
    destination: 'MAD',
    departure_date: '2026-12-10',
    return_date: null,
    price_disclaimer: PODIUM.price_disclaimer,
    offer: {
      ...offer,
      legs: offer.legs.map((leg) => ({
        ...leg,
        segments: leg.segments.map(({ from, to, ...segment }) => ({
          ...segment,
          from_iata: from,
          to_iata: to,
        })),
      })),
      profile: 'BALANCED',
      weights: PODIUM.preferences.weights,
      quoted_at: new Date().toISOString(),
    },
    created_at: new Date().toISOString(),
  };
}

/** Backend de itinerarios en memoria: lista, guardar, detalle y eliminar. */
async function mockItineraries(page: Page, items: SavedItinerary[]) {
  const page50 = () => ({ items, page: 1, page_size: 50, total: items.length });
  await page.route('**/api/v1/itineraries?*', (route) => json(route, 200, page50()));
  await page.route('**/api/v1/itineraries', (route) => {
    const { offer_id } = route.request().postDataJSON() as { offer_id: string };
    const existing = items.find((item) => item.offer.offer_id === offer_id);
    if (existing) return json(route, 200, existing);
    const created = toItinerary(offer_id, items.length + 1);
    items.unshift(created);
    return json(route, 201, created);
  });
  await page.route('**/api/v1/itineraries/*', (route: Route) => {
    const id = route.request().url().split('/').pop()!;
    const index = items.findIndex((item) => item.id === id);
    const found = items[index];
    if (!found) {
      return json(route, 404, {
        title: 'No existe',
        status: 404,
        detail: 'No existe',
        code: 'ITINERARY_NOT_FOUND',
      });
    }
    if (route.request().method() === 'DELETE') {
      items.splice(index, 1);
      return route.fulfill({ status: 204 });
    }
    return json(route, 200, found);
  });
}

async function expectAxeLightAndDark(page: Page) {
  await page.locator('html').evaluate((el) => el.classList.remove('dark'));
  await expectNoAxeViolations(page);
  await page.locator('html').evaluate((el) => el.classList.add('dark'));
  await expectNoAxeViolations(page);
  await page.locator('html').evaluate((el) => el.classList.remove('dark'));
}

async function expectNoHorizontalOverflow(page: Page) {
  const hasOverflow = await page.locator('html').evaluate((el) => el.scrollWidth > el.clientWidth);
  expect(hasOverflow).toBe(false);
}

test.describe('Itinerarios guardados (Plan 6)', () => {
  test('podio → Guardar → detalle → lista → eliminar con confirmación → vacío, con axe en claro y oscuro', async ({
    page,
  }) => {
    const items: SavedItinerary[] = [];
    await mockApi(page, (route) => json(route, 200, PODIUM));
    await mockItineraries(page, items);

    // US-22: guardar desde el podio, gratis.
    await page.goto(SEARCH_URL);
    await page.getByRole('button', { name: 'Buscar' }).click();
    const list = page.getByRole('list', { name: 'Recomendaciones ordenadas de mejor a peor' });
    const second = list.locator(':scope > li').nth(1);
    await expect(second.getByText('USD 760')).toBeVisible();
    await expect(page.getByRole('link', { name: /Saldo: 10 créditos/ })).toBeVisible();
    await second.getByRole('button', { name: /^Guardar/ }).click();
    const saved = second.getByRole('link', { name: 'Guardado. Ver itinerario' });
    await expect(saved).toBeVisible();
    await expect(page.getByText(/Guardado en tus itinerarios: LIM → MAD/)).toBeAttached();
    await expect(page.getByRole('link', { name: /Saldo: 10 créditos/ })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectAxeLightAndDark(page);

    // US-23: detalle con el mapa de la ruta y el precio de ese momento.
    await saved.click();
    await expect(page).toHaveURL(/\/app\/itineraries\/00000000-/);
    await expect(
      page.getByRole('heading', { level: 1, name: 'LIM → MAD · 2026-12-10' }),
    ).toBeVisible();
    await expect(page.getByRole('region', { name: 'Mapa de la ruta guardada' })).toBeVisible();
    const card = page.getByRole('group', { name: 'Cotizado con el perfil Equilibrado' });
    await expect(card.getByText('USD 760')).toBeVisible();
    await expect(card.getByText(/Precio del .*; puede haber cambiado\./)).toBeVisible();
    await expect(card.getByRole('link', { name: /Comprar/ })).toHaveAttribute(
      'href',
      'https://book.navby.example/offer-2',
    );
    await expectNoHorizontalOverflow(page);
    await expectAxeLightAndDark(page);

    // Lista: la fila con precio y fechas.
    await page.getByRole('link', { name: 'Volver a mis itinerarios' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Mis itinerarios' })).toBeVisible();
    const row = page
      .getByRole('list', { name: 'Itinerarios guardados' })
      .locator(':scope > li')
      .first();
    await expect(row.getByText('USD 760')).toBeVisible();
    await expect(page.getByText('1 de 50')).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectAxeLightAndDark(page);

    // US-24: la confirmación se puede cancelar y, al confirmar, la lista queda vacía.
    const deleteButton = row.getByRole('button', { name: /^Eliminar/ });
    await deleteButton.click();
    const dialog = page.getByRole('dialog', { name: '¿Eliminar este itinerario?' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Cancelar' })).toBeFocused();
    await expectAxeLightAndDark(page);
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(deleteButton).toBeFocused();

    await deleteButton.click();
    await dialog.getByRole('button', { name: 'Eliminar' }).click();
    await expect(page.getByText('Aún no guardas itinerarios')).toBeVisible();
    await expect(page.getByText('Itinerario eliminado')).toBeAttached();
    await expect(page.getByRole('heading', { level: 1, name: 'Mis itinerarios' })).toBeFocused();
    expect(items).toHaveLength(0);
    await expectNoHorizontalOverflow(page);
    await expectAxeLightAndDark(page);
  });

  test('un itinerario que no existe (o es de otra persona) lo dice sin revelar nada', async ({
    page,
  }) => {
    await mockApi(page, (route) => json(route, 200, PODIUM));
    await mockItineraries(page, []);

    await page.goto('/app/itineraries/00000000-0000-4000-8000-0000000000ff');
    await expect(page.getByText('Este itinerario no existe')).toBeVisible();
    await expectNoAxeViolations(page);
    await page.getByRole('link', { name: 'Volver a mis itinerarios' }).last().click();
    await expect(page.getByText('Aún no guardas itinerarios')).toBeVisible();
  });
});
