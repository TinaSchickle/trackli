import { describe, it, expect, vi } from 'vitest';

vi.mock('../cloud/supabase.js', () => ({ supabase: null, isCloudConfigured: false }));

const { suggestUsername, loginToEmail, displayLogin, USERNAME_PATTERN, normalizeUsername } = await import(
  '../cloud/auth.js'
);

describe('suggestUsername', () => {
  it('setzt beide Vornamen mit „Und“ zusammen', () => {
    expect(suggestUsername('Tina', 'Pascal')).toBe('TinaUndPascal');
    expect(suggestUsername(' tina ', 'pascal')).toBe('TinaUndPascal');
  });

  it('schreibt Umlaute um und nimmt nur den ersten Vornamen', () => {
    expect(suggestUsername('Jörg', 'Anna-Lena Müller')).toBe('JoergUndAnnaLena');
    expect(suggestUsername('René', 'Sabine')).toBe('ReneUndSabine');
  });

  it('funktioniert, solange erst ein Name da ist', () => {
    expect(suggestUsername('Tina', '')).toBe('Tina');
    expect(suggestUsername('', '')).toBe('');
  });

  it('Vorschlag ist ein gültiger Benutzername', () => {
    expect(USERNAME_PATTERN.test(normalizeUsername(suggestUsername('Tina', 'Pascal')))).toBe(true);
  });
});

describe('Login unabhängig von Groß-/Kleinschreibung', () => {
  it('TinaUndPascal und tinaundpascal ergeben dieselbe Adresse', () => {
    expect(loginToEmail('TinaUndPascal')).toBe(loginToEmail('tinaundpascal'));
  });

  it('zeigt den gewählten Benutzernamen in seiner Schreibweise an', () => {
    const user = { email: 'tinaundpascal@users.trackli.app', user_metadata: { username: 'TinaUndPascal' } };
    expect(displayLogin(user)).toBe('TinaUndPascal');
    expect(displayLogin('tinaundpascal@users.trackli.app')).toBe('tinaundpascal');
  });
});
