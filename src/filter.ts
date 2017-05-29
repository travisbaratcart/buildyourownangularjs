export class FilterService {
  private filters: { [filterName: string]: () => any } = {};

  public register(name: string, factory: () => any) {
    const filter = factory();
    this.filters[name] = filter;
    return filter;
  }

  public filter(filterName: string): () => any {
    return this.filters[filterName];
  }
}
