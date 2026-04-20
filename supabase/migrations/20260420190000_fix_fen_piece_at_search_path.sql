create or replace function public.fen_piece_at(p_fen text, p_square text)
returns text
language plpgsql
immutable
strict
set search_path = public
as $$
declare
  v_board text := split_part(p_fen, ' ', 1);
  v_rows text[] := string_to_array(split_part(p_fen, ' ', 1), '/');
  v_file integer := ascii(substr(p_square, 1, 1)) - ascii('a') + 1;
  v_rank integer := substr(p_square, 2, 1)::integer;
  v_row text;
  v_col integer := 0;
  v_char text;
  v_index integer;
begin
  if p_square !~ '^[a-h][1-8]$' or v_board = '' or array_length(v_rows, 1) <> 8 then
    return null;
  end if;

  v_row := v_rows[9 - v_rank];

  for v_index in 1..char_length(v_row) loop
    v_char := substr(v_row, v_index, 1);

    if v_char ~ '^[1-8]$' then
      v_col := v_col + v_char::integer;
      if v_col >= v_file then
        return null;
      end if;
    else
      v_col := v_col + 1;
      if v_col = v_file then
        return v_char;
      end if;
    end if;
  end loop;

  return null;
end;
$$;
