<?php
class ControllerApiUnisoukOrders extends Controller {
	private function respond($json) {
		$this->response->addHeader('Content-Type: application/json');
		$this->response->setOutput(json_encode($json));
	}

	private function requireApiSession() {
		$this->load->language('api/unisouk/orders');

		if (!isset($this->session->data['api_id'])) {
			$this->respond(array('error' => $this->language->get('error_permission')));
			return false;
		}

		return true;
	}

	private function mapOrderRow($row) {
		$this->load->model('checkout/order');
		$order_products = $this->model_checkout_order->getOrderProducts($row['order_id']);
		$products = array();

		foreach ($order_products as $product) {
			$option_value_id = 0;
			$option_value_ids = array();
			$options = $this->model_checkout_order->getOrderOptions($row['order_id'], $product['order_product_id']);

			foreach ($options as $option) {
				if (!empty($option['product_option_value_id'])) {
					$option_value_ids[] = (int)$option['product_option_value_id'];
				}
			}

			if (!empty($option_value_ids)) {
				$option_value_id = $option_value_ids[0];
			}

			$products[] = array(
				'order_product_id' => (int)$product['order_product_id'],
				'product_id'       => (int)$product['product_id'],
				'name'             => $product['name'],
				'quantity'         => (int)$product['quantity'],
				'price'            => (float)$product['price'],
				'option_value_id'  => $option_value_id,
				'option_value_ids' => $option_value_ids,
			);
		}

		return array(
			'order_id'        => (int)$row['order_id'],
			'firstname'       => $row['firstname'],
			'lastname'        => $row['lastname'],
			'email'           => $row['email'],
			'total'           => (float)$row['total'],
			'order_status_id' => (int)$row['order_status_id'],
			'date_added'      => $row['date_added'],
			'products'        => $products,
		);
	}

	public function index() {
		if (!$this->requireApiSession()) {
			return;
		}

		$page  = isset($this->request->post['page']) ? max(1, (int)$this->request->post['page']) : 1;
		$limit = isset($this->request->post['limit']) ? max(1, (int)$this->request->post['limit']) : 20;
		$start = ($page - 1) * $limit;

		$sql = "SELECT o.order_id, o.firstname, o.lastname, o.email, o.total, o.order_status_id, o.date_added FROM `" . DB_PREFIX . "order` o WHERE 1 = 1";

		if (!empty($this->request->post['order_status_id'])) {
			$sql .= " AND o.order_status_id = '" . (int)$this->request->post['order_status_id'] . "'";
		}

		if (!empty($this->request->post['date_from'])) {
			$sql .= " AND DATE(o.date_added) >= DATE('" . $this->db->escape($this->request->post['date_from']) . "')";
		}

		if (!empty($this->request->post['date_to'])) {
			$sql .= " AND DATE(o.date_added) <= DATE('" . $this->db->escape($this->request->post['date_to']) . "')";
		}

		$count_sql = str_replace('o.order_id, o.firstname, o.lastname, o.email, o.total, o.order_status_id, o.date_added', 'COUNT(*) AS total', $sql);
		$total_query = $this->db->query($count_sql);
		$total = (int)$total_query->row['total'];

		$sql .= " ORDER BY o.order_id DESC LIMIT " . (int)$start . "," . (int)$limit;
		$query = $this->db->query($sql);

		$orders = array();
		foreach ($query->rows as $row) {
			$orders[] = $this->mapOrderRow($row);
		}

		$this->respond(array(
			'success' => true,
			'data'    => array(
				'orders' => $orders,
				'total'  => $total,
			),
		));
	}
}
