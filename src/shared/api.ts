export type InitResponse = {
  type: 'init';
  postId: string;
  username: string | null;
};

export type ErrorResponse = {
  status: 'error';
  message: string;
};
