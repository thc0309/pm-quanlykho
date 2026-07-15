# Hướng dẫn sử dụng Warehouse Suite

Tài liệu này dành cho quản trị viên kho, nhân viên nhập/xuất, người soạn hàng và người kiểm hàng. Tên màn hình và nút bấm bên dưới bám theo giao diện hiện tại của hệ thống.

## 1. Nguyên tắc vận hành quan trọng

- Mỗi tài khoản chỉ thao tác trong kho và phạm vi quyền được cấp.
- Không có đăng ký công khai. Quản trị viên tạo tài khoản và cấp vai trò cho người dùng.
- Phiếu nháp chưa làm thay đổi tồn kho thực tế.
- Chỉ **xác nhận phiếu nhập** mới tăng `On hand`.
- Chỉ **Xác nhận và xuất kho** sau khi kiểm hàng mới giảm `On hand`.
- `Committed = Reserved + Picked`; `Available = On hand - Committed`.
- Phiếu đã xác nhận không được sửa hoặc xóa trực tiếp. Nếu sai, dùng nghiệp vụ đảo/điều chỉnh được cấp quyền.
- Nên để người soạn và người kiểm là hai người khác nhau. Hệ thống sẽ từ chối tự kiểm nếu không có quyền giám sát phù hợp.

## 2. Đăng nhập và tài khoản

1. Mở địa chỉ hệ thống do quản trị viên cung cấp.
2. Nhập email và mật khẩu, sau đó chọn **Đăng nhập**.
3. Nếu đăng nhập bằng mật khẩu tạm, hệ thống yêu cầu đổi mật khẩu trước khi cho thao tác nghiệp vụ. Nhập mật khẩu mới theo yêu cầu hiển thị và xác nhận.
4. Khi hoàn tất công việc, dùng chức năng đăng xuất trong khu vực tài khoản.

Nếu không thấy một menu hoặc nút thao tác, tài khoản chưa có quyền tương ứng. Liên hệ quản trị viên kho thay vì dùng tài khoản của người khác.

## 3. Chuẩn bị dữ liệu ban đầu

Quản trị viên nên thiết lập theo thứ tự sau để các biểu mẫu nghiệp vụ có đủ dữ liệu lựa chọn.

### 3.1. Người dùng, vai trò và quyền

Trong nhóm **Quản trị**:

1. Vào **Người dùng** để tạo tài khoản, gán vai trò và kích hoạt/vô hiệu hóa tài khoản.
2. Vào **Vai trò** để tạo nhóm quyền theo công việc, ví dụ quản trị kho, nhập kho, picker, checker hoặc báo cáo.
3. Vào **Quyền** để kiểm tra các quyền được hệ thống hỗ trợ.

Chỉ cấp đúng quyền cần thiết. Khi nhân sự nghỉ hoặc chuyển vị trí, vô hiệu hóa tài khoản cũ và cập nhật vai trò ngay.

### 3.2. Vị trí kho

Vào **Vị trí** và tạo mã vị trí duy nhất cho từng khu vực:

- `storage`: vị trí lưu trữ hàng;
- `staging`: khu tập kết để kiểm hàng;
- `shipping`: khu chờ giao/xuất.

Mã vị trí nên ngắn, dễ đọc và trùng với barcode dán thực tế, ví dụ `A-01-02`.

### 3.3. Danh mục, đơn vị và sản phẩm

1. Tạo **Danh mục** và **Đơn vị** trước.
2. Vào **Sản phẩm**, tạo SKU, tên, barcode và chọn chế độ theo dõi:
   - `none`: không theo dõi lô/serial;
   - `lot`: bắt buộc mã lô khi nhập;
   - `serial`: bắt buộc serial khi nhập.
3. Bật quản lý hạn dùng cho sản phẩm cần FEFO. Khi đó hạn dùng là bắt buộc trên phiếu nhập.

SKU, barcode, mã lô và serial cần được nhập chính xác ngay từ đầu vì chúng được dùng xuyên suốt các bước quét, truy xuất và báo cáo.

### 3.4. Đối tác

Vào **Đối tác** để tạo nhà cung cấp và khách hàng trước khi lập đơn mua, đơn bán hoặc chứng từ liên quan.

## 4. Nhập kho

### 4.1. Tạo phiếu nhập

1. Vào **Phiếu nhập** > **Thêm phiếu nhập**.
2. Nhập **Số phiếu** duy nhất.
3. Chọn **Sản phẩm**, **Vị trí** nhận hàng và **Số lượng**.
4. Điền thông tin xuất hiện theo cấu hình sản phẩm:
   - sản phẩm theo lô: nhập **Mã lô**, có thể nhập **Ngày sản xuất**;
   - sản phẩm theo serial: nhập **Serial**;
   - sản phẩm quản lý hạn dùng: nhập **Hạn dùng**.
5. Chọn **Tạo phiếu nhập**. Phiếu mới ở trạng thái nháp và chưa tăng tồn.

Giao diện hiện tại tạo một dòng hàng cho mỗi lần lập phiếu. Nếu cần nhiều SKU, tạo các phiếu phù hợp theo quy trình vận hành đang áp dụng.

### 4.2. Xác nhận và in phiếu

1. Quay lại danh sách **Phiếu nhập**.
2. Kiểm tra số phiếu, số dòng, vị trí, lô/serial và hạn dùng.
3. Chọn biểu tượng xác nhận ở dòng phiếu nháp.
4. Sau khi trạng thái thành **Đã xác nhận**, tồn `On hand` mới tăng.
5. Chọn **In phiếu** để mở mẫu in, rồi dùng hộp thoại in của trình duyệt.

Không xác nhận nếu hàng thực nhận, lô, serial hoặc hạn dùng chưa khớp với chứng từ.

## 5. Xem tồn kho và truy xuất

Vào **Tồn kho** và chọn một trong bốn chế độ:

- **Tồn kho**: xem số lượng theo vị trí và sản phẩm;
- **Lô**: tra cứu lô và hạn dùng;
- **Serial**: tra cứu từng serial;
- **Movement**: xem lịch sử biến động tồn.

Dùng ô **Tìm tồn kho**, chọn **Lọc**, sau đó dùng **Trang trước** hoặc **Trang sau**. Khi đánh giá khả năng xuất hàng, dùng `Available`, không chỉ nhìn `On hand`, vì một phần tồn có thể đã được giữ cho phiếu khác.

## 6. Xuất kho từ đầu đến cuối

Luồng chuẩn là:

`Nháp -> Chờ soạn -> Đang soạn -> Đã soạn -> Đang kiểm -> Đã xuất`

Nếu kiểm sai, phiếu chuyển về trạng thái cần soạn lại rồi quay lại bước soạn.

### 6.1. Tạo và release phiếu xuất

1. Vào **Phiếu xuất** > **Thêm phiếu xuất**.
2. Nhập **Số phiếu**, chọn **Sản phẩm**, nhập **Số lượng** và chọn **Tạo phiếu xuất**.
3. Quay lại danh sách **Phiếu xuất**.
4. Chọn biểu tượng release ở dòng phiếu nháp.

Khi release, hệ thống giữ tồn khả dụng theo FEFO và chuyển phiếu sang **Chờ soạn**. Nếu báo không thể release, kiểm tra `Available`, lô/hạn dùng và các phiếu khác đang giữ tồn.

### 6.2. Soạn hàng

1. Người soạn vào **Soạn hàng**.
2. Chọn **Nhận phiếu**; nếu đã nhận trước đó, chọn **Tiếp tục**.
3. Quét hoặc nhập **Barcode vị trí**.
4. Quét **Barcode sản phẩm / lô / serial**.
5. Chọn **Lưu lần quét** và theo dõi tiến độ `đã soạn / cần soạn`.
6. Khi đủ số lượng, chọn **Xác nhận đã soạn**.

Nếu hệ thống báo mã vị trí hoặc hàng không khớp FEFO, không lấy hàng khác để lách cảnh báo. Đặt hàng lại đúng chỗ và kiểm tra lô được hệ thống phân bổ.

### 6.3. Kiểm hàng và xuất kho

1. Người kiểm khác vào **Kiểm hàng**.
2. Chọn **Nhận kiểm**; nếu đã nhận trước đó, chọn **Tiếp tục**.
3. Quét **Barcode staging**.
4. Quét **Barcode sản phẩm / lô / serial**.
5. Chọn **Lưu lần kiểm** cho đến khi đạt đủ tiến độ.
6. Chọn **Xác nhận và xuất kho**.

Đây là thời điểm tồn `On hand` thực sự giảm. Nếu phiếu đã thay đổi trong lúc kiểm hoặc chưa kiểm đủ, tải lại dữ liệu và đối chiếu trước khi thử lại.

### 6.4. Ngoại lệ phiếu xuất

Vào **Ngoại lệ phiếu xuất**, nhập lý do rõ ràng rồi chọn hành động phù hợp:

- **Cần soạn lại**: dùng khi kiểm phát hiện hàng không khớp; phiếu quay lại luồng soạn;
- **Duyệt xuất thiếu**: chỉ người có thẩm quyền dùng khi chấp nhận số lượng thiếu;
- **Hủy phiếu**: chỉ dùng ở trạng thái hệ thống cho phép và trước khi xuất thực tế.

Phiếu đã xuất không được hủy hoặc sửa trực tiếp; phải dùng nghiệp vụ đảo/điều chỉnh có dấu vết kiểm toán.

## 7. Mua hàng và bán hàng

### 7.1. Đơn mua

1. Vào **Mua hàng** > **Tạo đơn mua**.
2. Nhập số đơn, chọn nhà cung cấp, sản phẩm và số lượng.
3. Tạo đơn rồi chọn **Duyệt PO** trên dòng đơn nháp.
4. Khi hàng về, thực hiện nhập thực tế tại **Phiếu nhập** và chỉ xác nhận sau khi kiểm đếm.

Giao diện hiện tại chưa có nút nhận hàng trực tiếp từ PO; liên kết nhận hàng theo PO chỉ dùng qua API/quy trình nội bộ nếu đơn vị đã tích hợp.

### 7.2. Báo giá và đơn bán

1. Vào **Bán hàng** > **Tạo chứng từ bán**.
2. Nhập số chứng từ, chọn loại **Báo giá** hoặc **Đơn hàng**, khách hàng, sản phẩm, số lượng, đơn giá và thuế suất.
3. Tạo chứng từ rồi chọn **Duyệt** trên dòng nháp.
4. Lập và xử lý **Phiếu xuất** theo mục 6 để giao hàng.

Giao diện hiện tại chưa có nút phát hành hóa đơn sau giao hàng; chức năng này chỉ dùng qua API/quy trình nội bộ nếu đã tích hợp.

## 8. Hàng trả

1. Vào **Hàng trả** > **Tạo hàng trả**.
2. Chọn loại trả từ khách hàng hoặc trả nhà cung cấp.
3. Nhập **Document ID gốc**, **Movement ID gốc** và số lượng cần trả.
4. Tạo chứng từ, quay lại danh sách và chọn **Xác nhận trả**.

Luôn lấy đúng ID từ chứng từ và movement gốc. Không tự đoán ID; nếu không có quyền tra cứu, nhờ quản trị viên hoặc người phụ trách dữ liệu cung cấp.

## 9. Kiểm kê kho

1. Vào **Kiểm kê kho** > **Tạo kiểm kê**.
2. Nhập số kiểm kê và chọn stock key cần đếm.
3. Chọn **Freeze snapshot** để cố định số liệu đối chiếu tại thời điểm bắt đầu.
4. Sau khi nhập đủ kết quả đếm theo quy trình nội bộ, chọn **Gửi duyệt**.
5. Người có thẩm quyền kiểm tra chênh lệch và chọn **Duyệt điều chỉnh**.

Không duyệt điều chỉnh khi chưa xác minh chênh lệch vật lý, vị trí, lô và serial.

## 10. Chuyển kho

1. Vào **Chuyển kho** > **Tạo chuyển kho**.
2. Nhập số chuyển, **Target warehouse ID**, chọn stock key nguồn và số lượng.
3. Tạo phiếu rồi chọn **Dispatch** để xuất hàng khỏi kho nguồn, hoặc **Hủy** khi phiếu còn ở trạng thái cho phép.

Giao diện hiện tại chưa có nút xác nhận nhận hàng tại kho đích; bước nhận tại đích chỉ dùng qua API/quy trình nội bộ nếu đơn vị đã tích hợp. Không coi phiếu `dispatched` là đã hoàn tất tại kho đích.

## 11. Dashboard, báo cáo và xuất CSV

Trang **Tổng quan kho** hiển thị:

- `On hand`;
- `Committed`;
- `Available`;
- số lô sắp hết hạn;
- số movement trong ngày.

Tại **Báo cáo tồn kho**:

1. Nhập từ khóa vào **Tìm báo cáo** và chọn **Lọc**.
2. Kiểm tra SKU, sản phẩm, vị trí, lô/serial và `On hand`.
3. Dùng phân trang khi có nhiều dữ liệu.
4. Chọn **Export CSV** để tải dữ liệu theo bộ lọc hiện tại.

Dữ liệu báo cáo luôn bị giới hạn theo kho và quyền của tài khoản đang đăng nhập.

## 12. Scanner và thiết bị di động

Vào **Kiểm tra scanner** trước ca làm việc:

1. Với máy quét giả lập bàn phím, đặt con trỏ trong trang và quét. Mã nhận được xuất hiện tại **Mã đã quét**.
2. Trên Android, chọn **Mở camera Android**, cấp quyền camera và đưa mã vào khung hình.
3. Camera cần chạy trên HTTPS hoặc localhost. Nếu trình duyệt không hỗ trợ `BarcodeDetector`, dùng scanner bàn phím.

Nên kiểm tra barcode vị trí, SKU, lô và serial mẫu trước khi bắt đầu soạn hoặc kiểm số lượng lớn.

## 13. In chứng từ

- Chỉ chứng từ đủ điều kiện mới hiển thị chức năng in.
- Chọn **In phiếu** để mở trang in, kiểm tra nội dung rồi dùng hộp thoại in của trình duyệt.
- Hệ thống hiện chưa bật in im lặng qua Tauri; người dùng phải xác nhận máy in trong hộp thoại hệ thống.
- Kiểm tra khổ giấy, máy in và bản xem trước trước khi in hàng loạt.

## 14. Mất mạng và lỗi thường gặp

Ứng dụng có thể giữ lại phần khung giao diện khi mất mạng, nhưng các thao tác làm thay đổi dữ liệu sẽ bị chặn. Không bấm lặp lại nhiều lần; khôi phục kết nối, tải lại trang và kiểm tra trạng thái chứng từ trước khi thao tác tiếp.

| Hiện tượng | Cách xử lý |
| --- | --- |
| Không thấy menu hoặc nút | Kiểm tra vai trò/quyền và kho của tài khoản. |
| Không tạo được phiếu nhập | Kiểm tra số phiếu, vị trí, tracking lô/serial và hạn dùng bắt buộc. |
| Không release được phiếu xuất | Kiểm tra `Available`, số lượng và phân bổ FEFO. |
| Không nhận được phiếu soạn/kiểm | Phiếu có thể đã được người khác claim hoặc tài khoản không đủ quyền. |
| Quét không khớp | Quét lại đúng vị trí, staging, SKU, lô hoặc serial được phân bổ. |
| Không xuất kho được | Kiểm đủ số lượng, tải lại phiếu nếu phiên bản đã thay đổi. |
| Camera không mở | Dùng HTTPS/localhost, cấp quyền camera hoặc chuyển sang scanner bàn phím. |
| Dữ liệu không cập nhật sau mất mạng | Kết nối lại, tải lại trang và kiểm tra movement trước khi làm lại. |

## 15. Checklist cuối ca

- Không còn phiếu đã nhận nhưng chưa hoàn tất ngoài kế hoạch.
- Phiếu nhập đã xác nhận khớp hàng thực tế.
- Phiếu xuất đã giao có trạng thái đã xuất và movement tương ứng.
- Ngoại lệ có lý do rõ ràng và người phê duyệt phù hợp.
- Thiết bị scanner, camera và máy in không còn phiên làm việc dang dở.
- Đăng xuất khỏi thiết bị dùng chung.

## 16. Giới hạn triển khai hiện tại

Hệ thống phù hợp cho pilot nội bộ. Trước khi vận hành sản xuất bên ngoài, đơn vị cần hoàn tất kiểm thử trên thiết bị Android/máy quét thật, máy in thật, hạ tầng triển khai, sao lưu và giám sát. Các thao tác PO nhận hàng, phát hành hóa đơn và nhận chuyển kho tại đích hiện chưa có nút trên giao diện; chỉ sử dụng khi đã có tích hợp API/quy trình nội bộ được phê duyệt.
