import { Page, Locator } from '@playwright/test';

export type Target = {
  label: string;
  url: string;
  locator: (page: Page) => Locator;   // function returning a locator
  filename: string;
};

export const targets: Target[] = [
  {
    label: 'Welcome Banner',
    url: 'https://www.rockdalefcu.org/',
    locator: (page) => page.getByText('Welcome to Rockdale Federal Credit Union'),
    filename: 'welcome-banner',
  },
  {
    label: 'Main Hero Image',
    url: 'https://www.rockdalefcu.org/',
    locator: (page) => page.getByRole('img').first(),
    filename: 'hero-image',
  },
  {
    label: 'Main Navigation',
    url: 'https://www.rockdalefcu.org/',
    locator: (page) => page.locator('#navbar'),
    filename: 'nav-bar',
  },
];


