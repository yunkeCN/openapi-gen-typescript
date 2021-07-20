export const toHump = (name: string) => {
  return name.replace(/\-(\w)/g, function (all, letter) {
    return letter.toUpperCase();
  });
};
