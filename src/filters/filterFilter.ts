export function filterFilter() {
  return function(arr: any[], test: () => boolean) {
    return arr.filter(test);
  }
}
