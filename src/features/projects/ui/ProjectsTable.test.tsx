import { cleanup, render, screen } from '@testing-library/react';
import type { JSX } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';

import { makeProjects } from '@/test/fixtures/projects';

import { ProjectsTable } from './ProjectsTable';

function renderWithRouter(element: JSX.Element): ReturnType<typeof render> {
  return render(<MemoryRouter>{element}</MemoryRouter>);
}

afterEach(() => {
  cleanup();
});

describe('ProjectsTable', () => {
  it('renders one row per project with all four fields', () => {
    const projects = makeProjects(2);
    renderWithRouter(<ProjectsTable projects={projects} />);

    const rows = screen.getAllByRole('row');
    // One header row + one row per project.
    expect(rows).toHaveLength(projects.length + 1);

    const headers = screen.getAllByRole('columnheader').map((header) => header.textContent);
    expect(headers).toEqual(['Name', 'Status', 'Owner', 'Last updated']);

    for (const project of projects) {
      expect(screen.getByText(project.name)).toBeInTheDocument();
      expect(screen.getByText(project.owner.name)).toBeInTheDocument();
    }
  });

  it('makes the project name the only link in each row', () => {
    const projects = makeProjects(2);
    renderWithRouter(<ProjectsTable projects={projects} />);

    const dataRows = screen.getAllByRole('row').slice(1);
    expect(dataRows).toHaveLength(projects.length);

    for (const [index, row] of dataRows.entries()) {
      const project = projects[index]!;

      const links = Array.from(row.querySelectorAll('a'));
      expect(links).toHaveLength(1);
      const [firstLink] = links;
      expect(firstLink).toBeDefined();
      expect(firstLink).toHaveAttribute('href', `/projects/${project.id}`);
    }
  });

  it('exposes an accessible name through the caption', () => {
    const projects = makeProjects(1);
    renderWithRouter(<ProjectsTable projects={projects} />);

    expect(screen.getByRole('table')).toHaveAccessibleName('Projects');
  });
});
