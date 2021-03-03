export function returnError(path: string, message: string) {
    return { isSuccess: false, error: { path: path, message: message } };
}
