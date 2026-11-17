import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setSessionToken } from '@/shared/api/client';
import { type City } from '@/shared/api/schemas';
import { CityCombobox } from './CityCombobox';

const TOKYO: City = {
  city: 'Tokyo',
  city_es: 'Tokio',
  country: 'Japan',
  airports: [
    { iata: 'HND', name: 'Tokyo Haneda International Airport', lat: 35.5523, lon: 139.78 },
    { iata: 'NRT', name: 'Narita International Airport', lat: 35.7647, lon: 140.3864 },
  ],
};

const LONDON_UK: City = {
  city: 'London',
  city_es: 'Londres',
  country: 'United Kingdom',
  airports: [
    { iata: 'LCY', name: 'London City Airport', lat: 51.5053, lon: 0.0553 },
    { iata: 'LGW', name: 'London Gatwick Airport', lat: 51.1481, lon: -0.1903 },
    { iata: 'LHR', name: 'London Heathrow Airport', lat: 51.4775, lon: -0.4614 },
    { iata: 'LTN', name: 'London Luton Airport', lat: 51.8747, lon: -0.3683 },
    { iata: 'STN', name: 'London Stansted Airport', lat: 51.885, lon: 0.235 },
  ],
};

const BOGOTA: City = {
  city: 'Bogota',
  city_es: 'Bogotá',
  country: 'Colombia',
  airports: [{ iata: 'BOG', name: 'El Dorado International Airport', lat: 4.7016, lon: -74.1469 }],
};

function Harness() {
  const [city, setCity] = useState<City | null>(null);
  const [airports, setAirports] = useState<string[]>([]);

  return (
    <div>
      <CityCombobox
        label="Destino"
        placeholder="Ciudad o aeropuerto"
        selectedCity={city}
        selectedAirports={airports}
        onSelectCity={(nextCity, nextAirports) => {
          setCity(nextCity);
          setAirports(nextAirports);
        }}
        onToggleAirport={(iata) =>
          setAirports((prev) =>
            prev.includes(iata)
              ? prev.length > 1
                ? prev.filter((item) => item !== iata)
                : prev
              : [...prev, iata],
          )
        }
      />
      <output data-testid="selected-iatas">{airports.join(',')}</output>
    </div>
  );
}

function renderWithQuery() {
  setSessionToken('jwt-test', 900);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <Harness />
    </QueryClientProvider>,
  );
}

describe('CityCombobox (US-11 y US-14)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('no consulta con una letra y sugiere Tokio, Japón al escribir "Tok" (US-11)', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('q=Tok')) {
        return new Response(JSON.stringify({ cities: [TOKYO] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ cities: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    renderWithQuery();
    const user = userEvent.setup();
    const input = screen.getByRole('combobox', { name: 'Destino' });

    await user.type(input, 'a');
    await new Promise((r) => setTimeout(r, 250));
    expect(fetchMock).not.toHaveBeenCalled();

    await user.clear(input);
    await user.type(input, 'Tok');

    const option = await screen.findByRole('option', { name: /Tokio, Japón/ });
    expect(option).toBeInTheDocument();
    await user.click(option);

    expect(input).toHaveValue('Tokio, Japón');
    expect(screen.getByTestId('selected-iatas')).toHaveTextContent('HND,NRT');
  });

  it('encuentra Londres, Reino Unido con "LHR" y Bogotá, Colombia con "bogota" sin tildes (US-11)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('q=LHR')) {
          return new Response(JSON.stringify({ cities: [LONDON_UK] }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          });
        }
        if (url.includes('q=bogota')) {
          return new Response(JSON.stringify({ cities: [BOGOTA] }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          });
        }
        return new Response(JSON.stringify({ cities: [] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }),
    );

    renderWithQuery();
    const user = userEvent.setup();
    const input = screen.getByRole('combobox', { name: 'Destino' });

    await user.type(input, 'LHR');
    await expect(
      screen.findByRole('option', { name: /Londres, Reino Unido/ }),
    ).resolves.toBeVisible();

    await user.clear(input);
    await user.type(input, 'bogota');
    const bogotaOption = await screen.findByRole('option', { name: /Bogotá, Colombia/ });
    await user.click(bogotaOption);
    expect(input).toHaveValue('Bogotá, Colombia');
  });

  it('permite excluir Narita dejando Haneda y bloquea desmarcar el último aeropuerto (US-14)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ cities: [TOKYO] }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
      ),
    );

    renderWithQuery();
    const user = userEvent.setup();
    const input = screen.getByRole('combobox', { name: 'Destino' });

    await user.type(input, 'Tokio');
    await user.click(await screen.findByRole('option', { name: /Tokio, Japón/ }));

    const toggle = screen.getByRole('button', { name: /Aeropuertos de Tokio \(2\/2\)/ });
    await user.click(toggle);

    const naritaCheckbox = screen.getByRole('checkbox', { name: /Narita/ });
    const hanedaCheckbox = screen.getByRole('checkbox', { name: /Haneda/ });
    expect(naritaCheckbox).toBeChecked();
    expect(hanedaCheckbox).toBeChecked();

    await user.click(naritaCheckbox);
    await waitFor(() => expect(screen.getByTestId('selected-iatas')).toHaveTextContent('HND'));
    expect(hanedaCheckbox).toBeDisabled();
  });
});
