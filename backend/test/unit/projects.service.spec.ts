import { NotFoundException } from '@nestjs/common';
import { ProjectsService } from '../../src/modules/projects/projects.service';
import { ProjectsRepository } from '../../src/modules/projects/projects.repository';
import type { ProjectDocument } from '../../src/modules/projects/schemas/project.schema';

// ProjectsService only needs the injected delete hook in these unit tests.
// Mocking the module keeps the native Tree-sitter bindings out of this suite so
// source-parser.spec.ts remains the only unit suite that loads them.
jest.mock('../../src/modules/code-analysis/code-analysis.service', () => ({
  CodeAnalysisService: class {},
}));

describe('ProjectsService', () => {
  let service: ProjectsService;
  let repository: jest.Mocked<Pick<
    ProjectsRepository,
    'create' | 'findByOwner' | 'findByIdAndOwner' | 'updateByIdAndOwner' | 'deleteByIdAndOwner'
  >>;

  const ownerId = '507f1f77bcf86cd799439011';
  const projectId = '507f191e810c19729de860ea';

  const makeProject = (overrides: Partial<ProjectDocument> = {}): ProjectDocument =>
    ({
      id: projectId,
      name: 'Example',
      description: '',
      repositoryUrl: null,
      defaultBranch: 'main',
      primaryLanguage: null,
      analysisStatus: 'not_started',
      lastAnalyzedAt: null,
      createdAt: new Date('2025-01-01T00:00:00Z'),
      updatedAt: new Date('2025-01-01T00:00:00Z'),
      ...overrides,
    }) as unknown as ProjectDocument;

  beforeEach(() => {
    repository = {
      create: jest.fn(),
      findByOwner: jest.fn(),
      findByIdAndOwner: jest.fn(),
      updateByIdAndOwner: jest.fn(),
      deleteByIdAndOwner: jest.fn(),
    };
    service = new ProjectsService(
      repository as unknown as ProjectsRepository,
      { deleteProjectData: jest.fn() } as never,
      { deleteForProject: jest.fn() } as never,
      {
        deleteMany: jest.fn(() => ({ exec: jest.fn().mockResolvedValue(undefined) })),
      } as never,
      {
        deleteMany: jest.fn(() => ({ exec: jest.fn().mockResolvedValue(undefined) })),
      } as never,
    );
  });

  it('creates a project with owner-scoped defaults', async () => {
    repository.create.mockResolvedValue(makeProject());

    const result = await service.create(ownerId, { name: '  Example  ' });

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerId: expect.anything(),
        name: 'Example',
        description: '',
        repositoryUrl: null,
        defaultBranch: 'main',
      }),
    );
    expect(result.id).toBe(projectId);
    expect(result.analysisStatus).toBe('not_started');
  });

  it('returns paginated project lists with metadata', async () => {
    repository.findByOwner.mockResolvedValue({ items: [makeProject()], total: 3 });

    const result = await service.list(ownerId, 2, 1);

    expect(repository.findByOwner).toHaveBeenCalledWith(expect.anything(), 1, 1);
    expect(result.meta).toEqual({ page: 2, limit: 1, total: 3, totalPages: 3 });
    expect(result.items).toHaveLength(1);
  });

  it('does not expose another owner\'s project', async () => {
    repository.findByIdAndOwner.mockResolvedValue(null);
    await expect(service.get(ownerId, projectId)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('updates only fields that were supplied', async () => {
    repository.updateByIdAndOwner.mockResolvedValue(makeProject({ name: 'Renamed' }));

    const result = await service.update(ownerId, projectId, { name: '  Renamed  ' });

    expect(repository.updateByIdAndOwner).toHaveBeenCalledWith(
      projectId,
      expect.anything(),
      { name: 'Renamed' },
    );
    expect(result.name).toBe('Renamed');
  });

  it('reports deletion of a missing project as not found', async () => {
    repository.deleteByIdAndOwner.mockResolvedValue(false);
    await expect(service.remove(ownerId, projectId)).rejects.toBeInstanceOf(NotFoundException);
  });
});
